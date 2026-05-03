(function () {
  var trackingConfigLoaded = false;

  function pushEvent(name, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }

  function loadScript(src, attrs) {
    var script = document.createElement("script");
    script.async = true;
    script.src = src;
    Object.keys(attrs || {}).forEach(function (key) {
      script.setAttribute(key, attrs[key]);
    });
    document.head.appendChild(script);
  }

  function loadTrackingConfig() {
    if (trackingConfigLoaded) return;
    trackingConfigLoaded = true;

    fetch("/api/site-config", { headers: { "accept": "application/json" } })
      .then(function (response) {
        return response.ok ? response.json() : {};
      })
      .then(function (config) {
        if (config.gtmContainerId && !document.querySelector("script[src*='googletagmanager.com/gtm.js']")) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
          loadScript("https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(config.gtmContainerId));
        }

        if (config.gaMeasurementId) {
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
          window.gtag("js", new Date());
          window.gtag("config", config.gaMeasurementId);
          loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(config.gaMeasurementId));
        }

        if (config.clarityProjectId) {
          window.clarity = window.clarity || function () {
            (window.clarity.q = window.clarity.q || []).push(arguments);
          };
          loadScript("https://www.clarity.ms/tag/" + encodeURIComponent(config.clarityProjectId));
        }
      })
      .catch(function () {});
  }

  function formDataToObject(form) {
    var data = new FormData(form);
    var payload = {};
    data.forEach(function (value, key) {
      payload[key] = String(value || "").trim();
    });
    payload.page = window.location.href;
    payload.source = form.getAttribute("data-source") || "website";
    return payload;
  }

  function ensureMarketingConsentField(form) {
    if (form.querySelector("[name='marketing_consent']")) return;

    var submitButton = form.querySelector("button[type='submit']");
    if (!submitButton) return;

    var wrapper = document.createElement("label");
    wrapper.style.display = "block";
    wrapper.style.margin = "0 0 16px";
    wrapper.style.color = "#e5e5e5";
    wrapper.style.fontSize = "0.88rem";
    wrapper.style.lineHeight = "1.45";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.name = "marketing_consent";
    input.value = "yes";
    input.style.marginRight = "8px";

    wrapper.appendChild(input);
    wrapper.appendChild(document.createTextNode("I agree to receive occasional updates and offers from Casa4 Developments. Quote follow-up may still be sent about this enquiry."));
    submitButton.parentNode.insertBefore(wrapper, submitButton);
  }

  function buildMailto(payload) {
    var service = payload.service || "Website enquiry";
    var subject = "Casa4 Developments quote request - " + service;
    var body = [
      "New quote request from casa4developments.co.uk",
      "",
      "Name: " + (payload.name || "Not provided"),
      "Phone: " + (payload.phone || "Not provided"),
      "Email: " + (payload.email || "Not provided"),
      "Postcode / Area: " + (payload.postcode || "Not provided"),
      "Service Required: " + service,
      "Ideal Timeframe: " + (payload.timeframe || "Not provided"),
      "",
      "Project Details:",
      payload.message || "Not provided",
      "",
      "Page: " + window.location.href
    ].join("\n");

    return "mailto:info@casa4developments.co.uk?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function setStatus(form, message, isError) {
    var status = form.querySelector("[data-form-status]");
    if (!status) return;
    status.textContent = message;
    status.style.display = "block";
    status.style.color = isError ? "#ffd1d1" : "#e5e5e5";
  }

  async function submitLead(form) {
    var payload = formDataToObject(form);
    var submitButton = form.querySelector("button[type='submit']");

    if (!payload.name || !payload.phone) {
      alert("Please enter your name and phone number.");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = "Sending...";
    }

    pushEvent("lead_form_submit_attempt", {
      service: payload.service || "Website enquiry",
      form_source: payload.source
    });

    try {
      var response = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      var result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Lead capture is not configured.");
      }

      pushEvent("generate_lead", {
        service: payload.service || "Website enquiry",
        form_source: payload.source
      });

      window.location.href = result.redirect || "/thank-you.html";
    } catch (error) {
      setStatus(form, error.message + " Opening an email fallback now.", true);
      window.location.href = buildMailto(payload);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || "Send Message & Request Free Quote";
      }
    }
  }

  function prefillServiceFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var requestedService = params.get("service");
    if (!requestedService) return;

    document.querySelectorAll("select[name='service']").forEach(function (serviceSelect) {
      Array.from(serviceSelect.options).some(function (option) {
        if (option.text === requestedService) {
          serviceSelect.value = option.value;
          return true;
        }
        return false;
      });
    });
  }

  function trackClicks() {
    document.querySelectorAll("a[href^='tel:']").forEach(function (link) {
      link.addEventListener("click", function () {
        pushEvent("phone_click", { link_text: link.textContent.trim() });
      });
    });

    document.querySelectorAll("a[href*='wa.me']").forEach(function (link) {
      link.addEventListener("click", function () {
        pushEvent("whatsapp_click", { link_text: link.textContent.trim() });
      });
    });

    document.querySelectorAll("a[href*='contact.html']").forEach(function (link) {
      link.addEventListener("click", function () {
        pushEvent("quote_cta_click", { link_text: link.textContent.trim(), href: link.getAttribute("href") });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadTrackingConfig();
    prefillServiceFromUrl();
    trackClicks();

    document.querySelectorAll("form[data-lead-form]").forEach(function (form) {
      ensureMarketingConsentField(form);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitLead(form);
      });
    });
  });
})();
