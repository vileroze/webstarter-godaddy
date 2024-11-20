<?php
session_start();
require_once("../../../wp-load.php");

// GoDaddy API credentials - replace with your actual credentials
define('GODADDY_API_KEY', 'your_api_key');
define('GODADDY_API_SECRET', 'your_api_secret');
define('GODADDY_API_URL', 'https://api.godaddy.com/v1/payments');

header('Content-Type: application/json');

function createGoDaddyCustomer($email) {
    $customer_data = array(
        'email' => $email,
        'metadata' => array(
            'wordpress_user_id' => email_exists($email) ?: 'guest'
        )
    );

    $response = wp_remote_post(GODADDY_API_URL . '/customers', array(
        'headers' => array(
            'Authorization' => 'sso-key ' . GODADDY_API_KEY . ':' . GODADDY_API_SECRET,
            'Content-Type' => 'application/json'
        ),
        'body' => json_encode($customer_data)
    ));

    if (is_wp_error($response)) {
        throw new Exception($response->get_error_message());
    }

    return json_decode(wp_remote_retrieve_body($response));
}

function calculateOrderAmount($items) {
    $total = 0;
    foreach ($items as $product_id => list($payment_option, $installment_duration)) {
        $product = get_post($product_id);
        $price = get_wstr_price_value($product->ID);

        if ($payment_option === 'installment') {
            $total += (int)(($price / $installment_duration) * 100);
        } else {
            $total += (int)($price * 100);
        }
    }
    return $total;
}

function handleOneTimePayment($customer_id, $amount, $metadata) {
    $payment_data = array(
        'amount' => $amount,
        'currency' => 'USD',
        'customer' => $customer_id,
        'metadata' => $metadata,
        'capture_method' => 'automatic',
        'confirmation_method' => 'automatic'
    );

    $response = wp_remote_post(GODADDY_API_URL . '/charges', array(
        'headers' => array(
            'Authorization' => 'sso-key ' . GODADDY_API_KEY . ':' . GODADDY_API_SECRET,
            'Content-Type' => 'application/json'
        ),
        'body' => json_encode($payment_data)
    ));

    if (is_wp_error($response)) {
        throw new Exception($response->get_error_message());
    }

    return json_decode(wp_remote_retrieve_body($response));
}

function handleInstallmentPayment($customer_id, $cart) {
    $installment_data = array(
        'customer' => $customer_id,
        'currency' => 'USD',
        'installments' => array()
    );

    foreach ($cart as $product_id => list($payment_option, $installment_duration)) {
        if ($payment_option === 'installment') {
            $product = get_post($product_id);
            $price = get_wstr_price_value($product->ID);
            $monthly_amount = ceil(($price / $installment_duration) * 100);

            $installment_data['installments'][] = array(
                'amount' => $monthly_amount,
                'count' => $installment_duration,
                'interval' => 'month',
                'product_id' => $product_id,
                'description' => $product->post_title
            );
        }
    }

    $response = wp_remote_post(GODADDY_API_URL . '/installments', array(
        'headers' => array(
            'Authorization' => 'sso-key ' . GODADDY_API_KEY . ':' . GODADDY_API_SECRET,
            'Content-Type' => 'application/json'
        ),
        'body' => json_encode($installment_data)
    ));

    if (is_wp_error($response)) {
        throw new Exception($response->get_error_message());
    }

    return json_decode(wp_remote_retrieve_body($response));
}

try {
    // Get and decode the request body
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    // Validate cart
    if (!isset($_SESSION['cart']) || empty($_SESSION['cart'])) {
        throw new Exception('Cart is empty');
    }

    // Get customer email
    $customer_email = null;
    if (is_user_logged_in()) {
        $customer_email = wp_get_current_user()->user_email;
    } elseif (isset($data['email']) && !empty($data['email'])) {
        $customer_email = sanitize_email($data['email']);
    } else {
        throw new Exception('Email is required for checkout');
    }

    // Create or get customer
    $customer = createGoDaddyCustomer($customer_email);

    // Analyze cart for payment type
    $hasInstallment = false;
    $hasOneTime = false;
    foreach ($_SESSION['cart'] as $item) {
        if ($item[0] === 'installment') {
            $hasInstallment = true;
        } else {
            $hasOneTime = true;
        }
    }

    if ($hasInstallment) {
        $payment = handleInstallmentPayment($customer->id, $_SESSION['cart']);
    } else {
        $amount = calculateOrderAmount($_SESSION['cart']);
        $metadata = array(
            'cart_id' => session_id(),
            'wordpress_user_id' => get_current_user_id()
        );
        $payment = handleOneTimePayment($customer->id, $amount, $metadata);
    }

    echo json_encode(array(
        'clientToken' => $payment->client_token,
        'paymentId' => $payment->id,
        'isInstallment' => $hasInstallment,
        'customerId' => $customer->id
    ));

} catch (Exception $e) {
    http_response_code(500);
    error_log('GoDaddy payment error: ' . $e->getMessage());
    echo json_encode(array(
        'error' => $e->getMessage()
    ));
}