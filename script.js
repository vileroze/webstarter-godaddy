jQuery(document).ready(function ($) {
  // for getting domain age from the post title
  $("#title").on("change", function () {
    var domainName = jQuery("#title").val();
    /**
     * for getting domain age
     */
    $.ajax({
      type: "POST",
      url: cpmAjax.ajax_url,
      data: {
        action: "get_domain_age",
        domain_name: domainName,
      },
      success: function (response) {
        console.log(response);
        jQuery("#domainAge").val(response.data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("AJAX Error: ", textStatus, errorThrown);
      },
    });

    /**
     * for getting da/pa ranking
     */
    $.ajax({
      type: "POST",
      url: cpmAjax.ajax_url,
      data: {
        action: "get_domain_da_pa",
        domain_name: domainName,
      },
      success: function (response) {
        var daPaRanking = response.data.split("/");
        var da = daPaRanking[0];
        var pa = daPaRanking[1];
        jQuery("#domainDaPa").val(da + " / " + pa);
      },
    });
    getTLD(domainName);

    var domainLength = getDomainLength(domainName);
    if (domainLength) {
      $("#domainLength").val(domainLength);
    }
  });

  /**
   * function for displaying tld automatically for domain name
   * @param  url -> getting full domain url
   */
  function getTLD(url) {
    // Backend logic with jQuery
    var productTld = jQuery("#domainTld").find("select");
    var options_values = [];

    // Use jQuery .find("option") to get options
    productTld.find("option").each(function () {
      options_values.push(jQuery(this).val()); // getting all tld options values
    });

    // Use jQuery to iterate over options
    var domainParts = url.split(".");
    var tld = "." + domainParts[domainParts.length - 1];

    var tld_from_url = options_values.includes(tld);
    if (tld_from_url) {
      productTld.val(tld); // Use val() to set the value in jQuery
      // Trigger the change event
      productTld.trigger("change");
    }
  }

  /**
   * function for getting domain length
   */
  function getDomainLength(domain) {
    // Split the domain by the dot
    var parts = domain.split(".");

    // If there are more than two parts, we assume the last part is the TLD
    if (parts.length > 1) {
      // Remove the last part (TLD)
      parts.pop();
    }

    // Join the remaining parts and get the length
    var domainWithoutTLD = parts.join(".");
    return domainWithoutTLD.length;
  }


  // single domain tabs
  jQuery('ul.tabs li').on('click', function ($) {
    // get the data attribute
    var tab_id = jQuery(this).attr('data-tab');
    // remove the default classes
    jQuery('ul.tabs li').removeClass('current');
    jQuery('.tab-content').removeClass('current');
    // add new classes on mouse click
    jQuery(this).addClass('current');
    jQuery('#' + tab_id).addClass('current');
  });
});



























//=============================
//=======ADD TO CART===========
//=============================

jQuery(document).ready(function ($) {
  $(document).on('click', '.cart-icon', function () {
    $('#cart-dropdown').toggle();
  });

  // handle cart popup
  $(document).mouseup(function (e) {
    var container = $("#cart-dropdown");
    if (!container.is(e.target) && container.has(e.target).length === 0) {
      container.hide();
    }
  });

  function get_formatted_cart_items(cart) {
    let cart_item_string = '';

    cart.forEach(item => {
      let installment_string = '';
      if (item.payment_option === 'installment') {
        installment_string = ` / ${item.installment_duration} months`;
      }
      cart_item_string += `
        <div class="cart-item" >
          <img width="100" src="${item.image}" alt="${item.title}">
          <div class="cart-item-details">
            <p>${item.title}</p>
            <p>${item.currency} ${item.price}</p>
            <p>${item.payment_option} ${installment_string}</p>
          </div>
          <button class="remove-from-cart-btn" data-product-id="${item.id}">Remove</button>
        </div>
        `;
    });
    return cart_item_string;
  }

  function handleCartError(message) {
    // Create or update error message
    const errorDiv = $('.cart-error-message');4
    if (errorDiv.length === 0) {
      $('.wstr_payments').prepend(`
        <div class="cart-error-message" style="color: red; margin-bottom: 10px;">
          ${message}
        </div>
      `);
    } else {
      errorDiv.html(message);
    }

    // Auto-hide error after 5 seconds
    setTimeout(() => {
      $('.cart-error-message').fadeOut('slow', function () {
        $(this).remove();
      });
    }, 5000);
  }

  //retrieve and update cart items after page load
  $.ajax({
    type: "post",
    url: cpmAjax.ajax_url,
    data: {
      action: "wstr_retrieve_cart_items"
    },
    success: function (response) {
      let cart = response.data;
      let cart_string = get_formatted_cart_items(cart);
      $('body').append(`
        <div id="cart-dropdown">${cart_string}</div>
      `);

      $('#cart-dropdown').appendTo('.ws_header_cart');
      if (cart_string.trim() != '') {
        $('#cart-dropdown').append('<a href="/cart" class="view-cart-btn">VIEW CART</a>');
      }

      $('.cart-counter').html(cart.length);

      // Check cart type and update UI accordingly
      const hasInstallment = cart.some(item => item.payment_option === 'installment');
      const hasFullPayment = cart.some(item => item.payment_option === 'full');

      if (hasInstallment) {
        // If cart has installment product, disable full payment option
        $('#full_payment').prop('disabled', true);
        handleCartError('Note: Cart has an installment product. Remove it to add full payment products.');
      } else if (hasFullPayment) {
        // If cart has full payment products, disable installment option
        $('#installment_payment').prop('disabled', true);
        handleCartError('Note: Cart has full payment products. Remove them to add an installment product.');
      }
    },
  });

  //add items to cart
  $(document).on('click', '.add-to-cart-btn', function () {
    $this = $(this);
    $this.prop('disabled', true);
    $this.html('Adding...');

    var productId = $(this).data('product-id');
    var selectedPaymentOption = $('input[name="payment_option"]:checked').val();
    var selectedInstallmentDuration = $('.installment_duration:checked').val();

    $.ajax({
      type: "post",
      url: cpmAjax.ajax_url,
      data: {
        action: "wstr_add_item_to_cart",
        product_id: productId,
        payment_option: selectedPaymentOption,
        installment_duration: selectedInstallmentDuration,
        nonce: cpmAjax.nonce
      },
      success: function (response) {
        if (response.data.error) {
          handleCartError(response.data.error);
          $this.prop('disabled', false);
          $this.html('ADD TO CART');
          return;
        }

        let cart = response.data;
        let cart_string = get_formatted_cart_items(cart);
        $('#cart-dropdown').html(cart_string);

        if (cart_string.trim() != '') {
          $('#cart-dropdown').append('<a href="/cart" class="view-cart-btn">VIEW CART</A>');
        }

        $this.prop('disabled', false);
        $this.html('ADD TO CART');
        $this.hide();
        $this.siblings('.remove-from-cart-btn').show();
        $('.cart-counter').html(cart.length);

        // Update payment options based on what was added
        if (selectedPaymentOption === 'installment') {
          $('#full_payment').prop('disabled', true);
          handleCartError('Note: Cart has an installment product. Remove it to add full payment products.');
        } else {
          $('#installment_payment').prop('disabled', true);
          handleCartError('Note: Cart has full payment products. Remove them to add an installment product.');
        }
      },
    });
  });

  //remove items from cart
  $(document).on('click', '.remove-from-cart-btn', function () {
    $this = $(this);
    $this.prop('disabled', true);
    $this.html('Removing...');

    var productId = $(this).data('product-id');

    $.ajax({
      url: cpmAjax.ajax_url,
      type: "POST",
      data: {
        action: "wstr_remove_item_from_cart",
        product_id: productId,
        nonce: cpmAjax.nonce,
      },
      success: function (response) {
        $this.prop('disabled', false);
        $this.html('REMOVE FROM CART');

        let cart = response.data;
        let cart_string = get_formatted_cart_items(cart);
        $('#cart-dropdown').html(cart_string);

        if (cart_string.trim() != '') {
          $('#cart-dropdown').append('<a href="/cart" class="view-cart-btn">VIEW CART</a>');
        }

        $('#cart-page-wrapper').html(cart_string);

        $this.hide();
        $('.add-to-cart-btn[data-product-id="' + productId + '"]').show();
        $('.cart-counter').html(cart.length);

        // Re-enable all payment options if cart is empty
        if (cart.length === 0) {
          $('#full_payment').prop('disabled', false);
          $('#installment_payment').prop('disabled', false);
          $('.cart-error-message').remove();
        }
      },
    });
  });

  $(document).on('change', 'input[name="payment_option"]', function () {
    if ($('#installment_payment').is(':checked')) {
      $('#installment_duration_options').show();
    } else {
      $('#installment_duration_options').hide();
    }
  });
});