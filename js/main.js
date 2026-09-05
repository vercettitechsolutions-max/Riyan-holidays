(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();
    
    
    // Initiate the wowjs
    new WOW().init();
    
    
    // Dropdown on mouse hover
    const $dropdown = $(".dropdown");
    const $dropdownToggle = $(".dropdown-toggle");
    const $dropdownMenu = $(".dropdown-menu");
    const showClass = "show";
    
    $(window).on("load resize", function() {
        if (this.matchMedia("(min-width: 992px)").matches) {
            $dropdown.hover(
            function() {
                const $this = $(this);
                $this.addClass(showClass);
                $this.find($dropdownToggle).attr("aria-expanded", "true");
                $this.find($dropdownMenu).addClass(showClass);
            },
            function() {
                const $this = $(this);
                $this.removeClass(showClass);
                $this.find($dropdownToggle).attr("aria-expanded", "false");
                $this.find($dropdownMenu).removeClass(showClass);
            }
            );
        } else {
            $dropdown.off("mouseenter mouseleave");
        }
    });
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });



    // Header video: loop at half speed
    var headerVideo = document.getElementById('header-video');
    if (headerVideo) {
        var setHalfSpeed = function () {
            headerVideo.playbackRate = 0.5;
        };
        headerVideo.addEventListener('loadedmetadata', setHalfSpeed);
        headerVideo.addEventListener('play', setHalfSpeed);
        setHalfSpeed();
    }


    // ---- Live properties: powers both the booking dropdown and the room
    // cards below, from one shared fetch so admin-added properties show up
    // on the site with zero code changes.
    var API_BASE = 'https://riyan-holidays-backend.onrender.com/api/v1';

    var $bookingBox = $('#booking-property');
    var $roomsContainer = $('#rooms-container');

    if ($bookingBox.length || $roomsContainer.length) {
        $.getJSON(API_BASE + '/properties')
            .done(function (properties) {
                if ($bookingBox.length) {
                    properties.forEach(function (p) {
                        $bookingBox.append($('<option>', { value: p.slug, text: p.name, 'data-best-for': p.best_for_guests }));
                    });
                }
                if ($roomsContainer.length) {
                    renderRoomCards(properties);
                }
            })
            .fail(function () {
                if ($bookingBox.length) {
                    $bookingBox.append($('<option>', { value: '', text: 'Unable to load properties right now', disabled: true }));
                }
                if ($roomsContainer.length) {
                    $('#rooms-loading').attr('hidden', true);
                    $('#rooms-empty').text('Could not load villas right now - please refresh, or message us on WhatsApp.').removeAttr('hidden');
                }
            });
    }

    function renderRoomCards(properties) {
        $('#rooms-loading').attr('hidden', true);

        if (!properties.length) {
            $('#rooms-empty').removeAttr('hidden');
            return;
        }

        properties.forEach(function (p, index) {
            var photosHtml = p.photos.length
                ? p.photos.map(function (url) {
                    return '<div class="room-carousel-item"><img class="img-fluid" src="' + url + '" alt="' + p.name + '"></div>';
                }).join('')
                : '<div class="room-carousel-item"><div class="d-flex align-items-center justify-content-center bg-light text-body" style="height:280px;">Photos coming soon</div></div>';

            var descHtml = p.description ? '<p class="text-body mb-3">' + p.description + '</p>' : '';

            var $card = $(
                '<div class="col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="' + (0.1 + index * 0.2) + 's">' +
                    '<div class="room-item shadow rounded overflow-hidden">' +
                        '<div class="position-relative">' +
                            '<div class="owl-carousel room-carousel">' + photosHtml + '</div>' +
                            '<span class="room-price-badge">Enquire For Rates</span>' +
                        '</div>' +
                        '<div class="p-4 mt-2">' +
                            '<div class="d-flex justify-content-between mb-3"><h5 class="mb-0"></h5></div>' +
                            '<div class="d-flex mb-3"><small><i class="fa fa-user-friends text-primary me-2"></i>Best for ' + p.best_for_guests + ' guests</small></div>' +
                            descHtml +
                            '<div class="d-flex justify-content-between">' +
                                '<button type="button" class="btn btn-sm btn-primary rounded py-2 px-4 room-book-btn" data-property-slug="' + p.slug + '">Book Now</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );
            $card.find('h5').text(p.name); // .text() to avoid HTML injection from admin-entered names
            $roomsContainer.append($card);
        });

        $roomsContainer.find('.room-carousel').owlCarousel({
            autoplay: false,
            smartSpeed: 500,
            items: 1,
            loop: true,
            dots: true,
            nav: true,
            touchDrag: true,
            mouseDrag: true,
            navText: [
                '<i class="bi bi-chevron-left"></i>',
                '<i class="bi bi-chevron-right"></i>'
            ]
        });

        new WOW().init(); // re-scan for the freshly-added .wow elements

        $roomsContainer.on('click', '.room-book-btn', function () {
            var slug = $(this).data('property-slug');
            if ($bookingBox.length) {
                $bookingBox.val(slug).trigger('change');
                $('html, body').animate({ scrollTop: $bookingBox.closest('.booking').offset().top - 100 }, 800);
            }
        });
    }


    // ---- Booking widget: property select, live quote, create booking ----
    if ($bookingBox.length) {
        var $checkin = $('#booking-checkin');
        var $checkout = $('#booking-checkout');
        var $adults = $('#booking-adults');
        var $children = $('#booking-children');
        var $submitBtn = $('#booking-submit');
        var $result = $('#booking-quote-result');
        var $addonsBox = $('#booking-addons');
        var $honeypot = $('#booking-company-website');
        var lastQuote = null; // {available, total_amount, ...} of the most recent successful quote

        // tempusdominus initializes on the wrapper div (#date1/#date2), not
        // the <input> itself - the input just displays the picked value.
        var $checkinWrap = $('#date1');
        var $checkoutWrap = $('#date2');

        // ignoreReadonly: the inputs are readonly (so guests can't type an
        // invalid date), but tempusdominus's show() silently refuses to open
        // on a readonly input unless this is set - without it, clicking the
        // box does nothing at all, with no error.
        $checkinWrap.datetimepicker({
            format: 'YYYY-MM-DD',
            minDate: new Date(),
            ignoreReadonly: true,
            icons: { time: 'fa fa-clock', date: 'fa fa-calendar', up: 'fa fa-chevron-up', down: 'fa fa-chevron-down', previous: 'fa fa-chevron-left', next: 'fa fa-chevron-right', today: 'fa fa-calendar-check', clear: 'fa fa-trash', close: 'fa fa-times' }
        });
        $checkoutWrap.datetimepicker({
            format: 'YYYY-MM-DD',
            minDate: new Date(),
            useCurrent: false,
            ignoreReadonly: true,
            icons: { time: 'fa fa-clock', date: 'fa fa-calendar', up: 'fa fa-chevron-up', down: 'fa fa-chevron-down', previous: 'fa fa-chevron-left', next: 'fa fa-chevron-right', today: 'fa fa-calendar-check', clear: 'fa fa-trash', close: 'fa fa-times' }
        });
        $checkinWrap.on('change.datetimepicker', function (e) {
            if (e.date) {
                $checkoutWrap.datetimepicker('minDate', e.date.clone().add(1, 'day'));
            }
            fetchQuote();
        });
        $checkoutWrap.on('change.datetimepicker', function () {
            fetchQuote();
        });

        // ---- Availability: grey out already-booked dates (website, admin-
        // blocked, or another booking channel) so guests can only pick free
        // dates, without needing to know which channel booked a given day.
        function expandBlockedDates(blocked) {
            var days = [];
            blocked.forEach(function (range) {
                var d = moment(range.start, 'YYYY-MM-DD');
                var end = moment(range.end, 'YYYY-MM-DD'); // end-exclusive: checkout day itself is free
                while (d.isBefore(end)) {
                    days.push(d.clone());
                    d.add(1, 'day');
                }
            });
            return days;
        }

        function loadAvailability(slug) {
            $checkinWrap.datetimepicker('disabledDates', []);
            $checkoutWrap.datetimepicker('disabledDates', []);
            if (!slug) return;

            $.getJSON(API_BASE + '/properties/' + encodeURIComponent(slug) + '/availability')
                .done(function (data) {
                    var disabled = expandBlockedDates(data.blocked || []);
                    $checkinWrap.datetimepicker('disabledDates', disabled);
                    $checkoutWrap.datetimepicker('disabledDates', disabled);
                });
        }

        // ---- Optional add-ons: fireplace, pickup, etc., priced per stay ----
        var addonsById = {};

        function selectedAddonIds() {
            return $addonsBox.find('input:checked').map(function () { return this.value; }).get();
        }

        function loadAddons(slug) {
            addonsById = {};
            $addonsBox.empty();
            if (!slug) return;

            $.getJSON(API_BASE + '/properties/' + encodeURIComponent(slug) + '/addons')
                .done(function (addons) {
                    if (!addons.length) return;
                    var $wrap = $('<div class="border rounded p-3"><div class="fw-bold mb-2">Optional Add-ons</div></div>');
                    addons.forEach(function (a) {
                        addonsById[a.id] = a;
                        var $check = $(
                            '<div class="form-check">' +
                                '<input class="form-check-input" type="checkbox" value="' + a.id + '" id="addon-' + a.id + '">' +
                                '<label class="form-check-label" for="addon-' + a.id + '"></label>' +
                            '</div>'
                        );
                        var labelText = a.name + ' (+₹' + a.price + ')' + (a.description ? ' - ' + a.description : '');
                        $check.find('label').text(labelText); // .text() avoids HTML injection from admin-entered names
                        $wrap.append($check);
                    });
                    $addonsBox.append($wrap);
                    $addonsBox.on('change', 'input[type="checkbox"]', fetchQuote);
                });
        }

        function renderMessage(html, type) {
            $result.html('<div class="alert alert-' + type + ' mb-0 py-2">' + html + '</div>');
        }

        function fetchQuote() {
            var slug = $bookingBox.val();
            var checkIn = $checkin.val();
            var checkOut = $checkout.val();
            lastQuote = null;

            if (!slug || !checkIn || !checkOut) {
                $result.empty();
                return;
            }

            var params = $.param({
                property: slug, check_in: checkIn, check_out: checkOut,
                adults: $adults.val(), children: $children.val(),
                addon_ids: selectedAddonIds().join(',')
            });

            renderMessage('Checking price&hellip;', 'secondary');

            $.getJSON(API_BASE + '/quote?' + params)
                .done(function (data) {
                    if (!data.available) {
                        renderMessage('<strong>Sorry, this property is already booked for those dates.</strong> Please try different dates.', 'danger');
                        return;
                    }
                    lastQuote = data;
                    var msg = '&#8377;' + data.room_total + ' for ' + data.nights + ' night' + (data.nights === 1 ? '' : 's');
                    if (data.addons && data.addons.length) {
                        msg += ' + &#8377;' + data.addons_total + ' add-ons';
                    }
                    msg = '<strong>&#8377;' + data.total_amount + ' total</strong><br><small>' + msg + '</small>';
                    if (!data.within_capacity) {
                        msg += '<br><small>Note: this property is best for ' + data.property.best_for_guests + ' guests.</small>';
                    }
                    renderMessage(msg, 'success');
                })
                .fail(function (xhr) {
                    var err = (xhr.responseJSON && xhr.responseJSON.error) || 'Could not calculate a price for that selection.';
                    renderMessage(err, 'warning');
                });
        }

        $bookingBox.on('change', function () {
            var slug = $bookingBox.val();
            loadAvailability(slug);
            loadAddons(slug);
            fetchQuote();
        });
        $adults.add($children).on('change', fetchQuote);

        $submitBtn.on('click', function () {
            if ($honeypot.val()) {
                return; // bot filled the hidden field, silently do nothing
            }
            if (!lastQuote || !lastQuote.available) {
                renderMessage('Please select a property and available dates first.', 'warning');
                return;
            }

            $submitBtn.prop('disabled', true).text('Booking...');

            $.ajax({
                url: API_BASE + '/bookings',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    property: $bookingBox.val(),
                    check_in: $checkin.val(),
                    check_out: $checkout.val(),
                    adults: $adults.val(),
                    children: $children.val(),
                    addon_ids: selectedAddonIds(),
                    company_website: $honeypot.val()
                })
            }).done(function (data) {
                window.location.href = 'booking-details.html?ref=' + encodeURIComponent(data.booking_reference);
            }).fail(function (xhr) {
                var err = (xhr.responseJSON && xhr.responseJSON.error) || 'Something went wrong, please try again.';
                renderMessage(err, 'danger');
                $submitBtn.prop('disabled', false).text('Book Now');
                fetchQuote(); // dates may have just been taken - refresh availability
            });
        });
    }


    // ---- Guest details page (booking-details.html) ----
    var $guestForm = $('#guest-details-form');
    if ($guestForm.length) {
        var params = new URLSearchParams(window.location.search);
        var reference = params.get('ref');

        var $loading = $('#booking-loading');
        var $notFound = $('#booking-not-found');
        var $content = $('#booking-content');

        function moneyFmt(amount) {
            return '₹' + amount;
        }

        if (!reference) {
            $loading.attr('hidden', true);
            $notFound.removeAttr('hidden');
        } else {
            $.getJSON(API_BASE + '/bookings/' + encodeURIComponent(reference))
                .done(function (b) {
                    $('#summary-reference').text(b.booking_reference);
                    $('#summary-property').text(b.property_name);
                    $('#summary-dates').text(b.check_in + ' → ' + b.check_out);
                    $('#summary-guests').text(b.num_adults + ' Adult' + (b.num_adults === 1 ? '' : 's') + (b.num_children ? (', ' + b.num_children + ' Child' + (b.num_children === 1 ? '' : 'ren')) : ''));
                    $('#summary-total').text(moneyFmt(b.total_amount));

                    if (b.selected_addons && b.selected_addons.length) {
                        var $addonsWrap = $('#summary-addons').empty().removeAttr('hidden');
                        $addonsWrap.append('<div class="mb-1">Add-ons</div>');
                        b.selected_addons.forEach(function (a) {
                            var $row = $('<div class="d-flex justify-content-between mb-1"><span></span><span></span></div>');
                            var $spans = $row.find('span');
                            $spans.eq(0).text(a.name);
                            $spans.eq(1).text(moneyFmt(a.price));
                            $addonsWrap.append($row);
                        });
                    }

                    if (b.guest_details_submitted) {
                        $('#guest-form-wrap').attr('hidden', true);
                        $('#guest-success').removeAttr('hidden');
                    }

                    $loading.attr('hidden', true);
                    $content.removeAttr('hidden');
                })
                .fail(function () {
                    $loading.attr('hidden', true);
                    $notFound.removeAttr('hidden');
                });
        }

        $guestForm.on('submit', function (e) {
            e.preventDefault();

            if ($('#guest-company-website').val()) {
                return; // bot honeypot
            }

            var $btn = $('#guest-submit-btn');
            var $msg = $('#guest-form-message');
            $msg.empty();

            var name = $('#guest-name').val().trim();
            var phone = $('#guest-phone').val().trim();
            if (!name || !phone) {
                $msg.html('<div class="alert alert-warning py-2">Please fill in your name and phone number.</div>');
                return;
            }

            var formData = new FormData();
            formData.append('guest_name', name);
            formData.append('guest_phone', phone);
            formData.append('guest_email', $('#guest-email').val().trim());
            formData.append('company_website', $('#guest-company-website').val());
            var fileInput = document.getElementById('guest-id-proof');
            if (fileInput.files.length) {
                formData.append('id_proof', fileInput.files[0]);
            }

            $btn.prop('disabled', true).text('Submitting...');

            $.ajax({
                url: API_BASE + '/bookings/' + encodeURIComponent(reference) + '/guest-details',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false
            }).done(function () {
                $('#guest-form-wrap').attr('hidden', true);
                $('#guest-success').removeAttr('hidden');
            }).fail(function (xhr) {
                var err = (xhr.responseJSON && xhr.responseJSON.error) || 'Something went wrong, please try again.';
                $msg.html('<div class="alert alert-danger py-2">' + err + '</div>');
                $btn.prop('disabled', false).text('Confirm Booking');
            });
        });
    }

})(jQuery);

