(function () {
  function pushEvent(name, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
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
    prefillServiceFromUrl();
    trackClicks();

    document.querySelectorAll("form[data-lead-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitLead(form);
      });
    });
  });
})();
