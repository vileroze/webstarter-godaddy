// Initialize GoDaddy Payments SDK
const gdpay = new GDPayments('your_client_id');

let paymentForm;
let customerId;
let isLoggedIn = false;

async function initialize() {
    try {
        // Check login status
        const loginStatus = await jQuery.ajax({
            url: cpmAjax.ajax_url,
            type: "GET",
            data: {
                action: "wstr_check_login_status",
            }
        });
        
        isLoggedIn = loginStatus.data.isLoggedIn;

        // Add email field for guest users
        if (!isLoggedIn) {
            const emailField = `
                <div id="email-element" class="mb-4">
                    <label for="customer-email" class="block text-sm font-medium text-gray-700">Email address*</label>
                    <input 
                        type="email" 
                        id="customer-email" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Enter your email"
                        required
                    />
                    <div id="email-errors" class="mt-1 text-sm text-red-600 hidden"></div>
                </div>
            `;
            jQuery('#payment-element').before(emailField);
        }

        // Initialize payment form for logged-in users immediately
        if (isLoggedIn) {
            await initializePaymentForm();
        }

    } catch (error) {
        console.error("Initialization error:", error);
        showMessage("Failed to initialize payment form. Please try again.");
    }
}

async function initializePaymentForm() {
    try {
        const email = !isLoggedIn ? document.getElementById('customer-email')?.value : null;
        
        const response = await jQuery.ajax({
            url: "/wp-content/themes/webstarter/godaddy-checkout.php",
            method: "POST",
            data: JSON.stringify({ email: email }),
            contentType: "application/json",
        });

        if (response.error) {
            showMessage(response.error);
            return false;
        }

        customerId = response.customerId;

        // Configure payment form
        const config = {
            clientToken: response.clientToken,
            containerId: 'payment-element',
            styles: {
                input: {
                    color: '#32325d',
                    fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                    fontSize: '16px',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                }
            }
        };

        // Create payment form
        paymentForm = await gdpay.createPaymentForm(config);
        return true;

    } catch (error) {
        console.error("Payment form initialization error:", error);
        showMessage("Failed to initialize payment form. Please try again.");
        return false;
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    try {
        if (!isLoggedIn) {
            const emailInput = document.getElementById('customer-email');
            if (!emailInput || !emailInput.value.trim()) {
                showMessage("Please enter your email address");
                return;
            }

            // Initialize payment form if not already initialized
            if (!paymentForm) {
                const initialized = await initializePaymentForm();
                if (!initialized) {
                    return;
                }
            }
        }

        setLoading(true);

        // Submit payment
        const result = await paymentForm.submit({
            customerId: customerId,
            email: !isLoggedIn ? document.getElementById('customer-email').value : undefined
        });

        if (result.error) {
            showMessage(result.error.message);
        } else {
            // Redirect to success page
            window.location.href = "https://webstarter.local/payment-success/";
        }
    } catch (error) {
        console.error("Payment submission error:", error);
        showMessage("An unexpected error occurred during payment processing.");
    } finally {
        setLoading(false);
    }
}

function showMessage(messageText) {
    const messageContainer = jQuery("#payment-message");
    messageContainer.removeClass("hidden").text(messageText);

    if (messageText) {
        setTimeout(function () {
            messageContainer.addClass("hidden").text("");
        }, 4000);
    }
}

function setLoading(isLoading) {
    const submitButton = jQuery("#submit");
    const spinner = jQuery("#spinner");
    const buttonText = jQuery("#button-text");

    submitButton.prop("disabled", isLoading);
    spinner.toggleClass("hidden", !isLoading);
    buttonText.toggleClass("hidden", isLoading);
}

jQuery(document).ready(() => {
    initialize();
    jQuery("#payment-form").on("submit", handleSubmit);
    
    // Add email input change handler for guest users
    if (!isLoggedIn) {
        jQuery("#customer-email").on("change", async function() {
            if (this.value.trim()) {
                await initializePaymentForm();
            }
        });
    }
});