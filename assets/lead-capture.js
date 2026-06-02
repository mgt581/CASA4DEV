(function () {
  var trackingConfigLoaded = false;
  var pageTracked = false;

  function getStorageValue(storage, key) {
    try {
      return storage.getItem(key);
    } catch (error) {
      return "";
    }
  }

  function setStorageValue(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (error) {}
  }

  function randomId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function getClientId() {
    var key = "casa4_client_id";
    var value = getStorageValue(window.localStorage, key);
    if (!value) {
      value = randomId("client");
      setStorageValue(window.localStorage, key, value);
    }
    return value;
  }

  function getSessionId() {
    var key = "casa4_session_id";
    var value = getStorageValue(window.sessionStorage, key);
    if (!value) {
      value = randomId("session");
      setStorageValue(window.sessionStorage, key, value);
    }
    return value;
  }

  function getLandingPage() {
    var key = "casa4_landing_page";
    var value = getStorageValue(window.sessionStorage, key);
    if (!value) {
      value = window.location.href;
      setStorageValue(window.sessionStorage, key, value);
    }
    return value;
  }

  function getStoredJson(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function setStoredJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function hostnameFromUrl(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function hasCampaignParams(params) {
    return ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid"].some(function (key) {
      return !!params.get(key);
    });
  }

  function inferTraffic(params, referrer) {
    if (params.get("gclid")) return { source: "google", medium: "cpc", campaign: params.get("utm_campaign") || "" };
    if (params.get("msclkid")) return { source: "microsoft", medium: "cpc", campaign: params.get("utm_campaign") || "" };
    if (params.get("fbclid")) return { source: "facebook", medium: "social", campaign: params.get("utm_campaign") || "" };
    if (params.get("utm_source")) {
      return {
        source: params.get("utm_source") || "",
        medium: params.get("utm_medium") || "",
        campaign: params.get("utm_campaign") || ""
      };
    }

    var host = hostnameFromUrl(referrer);
    if (!host) return { source: "direct", medium: "none", campaign: "" };
    if (/(^|\.)google\./.test(host)) return { source: "google", medium: "organic", campaign: "" };
    if (/(^|\.)bing\./.test(host)) return { source: "bing", medium: "organic", campaign: "" };
    if (/(^|\.)facebook\.|(^|\.)instagram\./.test(host)) return { source: host, medium: "social", campaign: "" };
    return { source: host, medium: "referral", campaign: "" };
  }

  function getFirstAttribution(params) {
    var key = "casa4_first_attribution";
    var stored = getStoredJson(window.localStorage, key);
    if (stored && stored.first_page) return stored;

    var referrer = document.referrer || "";
    var inferred = inferTraffic(params, referrer);
    stored = {
      first_page: window.location.href,
      first_referrer: referrer,
      first_utm_source: params.get("utm_source") || inferred.source,
      first_utm_medium: params.get("utm_medium") || inferred.medium,
      first_utm_campaign: params.get("utm_campaign") || inferred.campaign,
      first_utm_term: params.get("utm_term") || "",
      first_utm_content: params.get("utm_content") || "",
      first_gclid: params.get("gclid") || "",
      first_fbclid: params.get("fbclid") || "",
      first_msclkid: params.get("msclkid") || "",
      first_seen_at: new Date().toISOString()
    };
    setStoredJson(window.localStorage, key, stored);
    return stored;
  }

  function getAttribution() {
    var params = new URLSearchParams(window.location.search);
    var firstAttribution = getFirstAttribution(params);
    var currentTraffic = inferTraffic(params, document.referrer || "");
    var hasCurrentCampaign = hasCampaignParams(params);

    return {
      page: window.location.href,
      landing_page: getLandingPage(),
      referrer: document.referrer || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_term: params.get("utm_term") || "",
      utm_content: params.get("utm_content") || "",
      gclid: params.get("gclid") || "",
      fbclid: params.get("fbclid") || "",
      msclkid: params.get("msclkid") || "",
      traffic_source: hasCurrentCampaign ? currentTraffic.source : firstAttribution.first_utm_source || currentTraffic.source,
      traffic_medium: hasCurrentCampaign ? currentTraffic.medium : firstAttribution.first_utm_medium || currentTraffic.medium,
      traffic_campaign: hasCurrentCampaign ? currentTraffic.campaign : firstAttribution.first_utm_campaign || currentTraffic.campaign,
      first_page: firstAttribution.first_page || "",
      first_referrer: firstAttribution.first_referrer || "",
      first_utm_source: firstAttribution.first_utm_source || "",
      first_utm_medium: firstAttribution.first_utm_medium || "",
      first_utm_campaign: firstAttribution.first_utm_campaign || "",
      first_utm_term: firstAttribution.first_utm_term || "",
      first_utm_content: firstAttribution.first_utm_content || "",
      first_gclid: firstAttribution.first_gclid || "",
      first_fbclid: firstAttribution.first_fbclid || "",
      first_msclkid: firstAttribution.first_msclkid || "",
      first_seen_at: firstAttribution.first_seen_at || "",
      session_id: getSessionId(),
      client_id: getClientId()
    };
  }

  function storeLeadEvent(payload) {
    var body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/lead-event", blob)) return;
      } catch (error) {}
    }

    fetch("/api/lead-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function pushEvent(name, params) {
    var cleanParams = Object.assign({}, params || {});
    if (cleanParams.source && !cleanParams.event_source && !cleanParams.form_source) {
      cleanParams.event_source = cleanParams.source;
      delete cleanParams.source;
    }

    var eventPayload = Object.assign({}, getAttribution(), cleanParams, { event_name: name });
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, cleanParams));
    if (typeof window.gtag === "function") {
      window.gtag("event", name, cleanParams);
    }
    storeLeadEvent(eventPayload);
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
        var hasGtm = !!document.querySelector("script[src*='googletagmanager.com/gtm.js']");

        if (config.gtmContainerId && !hasGtm) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
          loadScript("https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(config.gtmContainerId));
          hasGtm = true;
        }

        if (config.gaMeasurementId && !hasGtm) {
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
    return Object.assign(payload, getAttribution());
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
      form_source: payload.source,
      source: payload.source
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
        form_source: payload.source,
        source: payload.source
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
        pushEvent("phone_click", {
          link_text: link.textContent.trim(),
          link_url: link.href,
          phone_number: link.getAttribute("href").replace(/^tel:/, "")
        });
      });
    });

    document.querySelectorAll("a[href*='wa.me']").forEach(function (link) {
      link.addEventListener("click", function () {
        var match = link.href.match(/wa\.me\/([^?]+)/);
        pushEvent("whatsapp_click", {
          link_text: link.textContent.trim(),
          link_url: link.href,
          whatsapp_number: match ? match[1] : ""
        });
      });
    });

    document.querySelectorAll("a[href^='sms:']").forEach(function (link) {
      link.addEventListener("click", function () {
        pushEvent("sms_click", {
          link_text: link.textContent.trim(),
          link_url: link.href,
          sms_number: link.getAttribute("href").replace(/^sms:/, "").split("?")[0]
        });
      });
    });

    document.querySelectorAll("a[href^='mailto:']").forEach(function (link) {
      link.addEventListener("click", function () {
        pushEvent("email_click", {
          link_text: link.textContent.trim(),
          link_url: link.href,
          email_address: link.getAttribute("href").replace(/^mailto:/, "").split("?")[0]
        });
      });
    });

    document.querySelectorAll("a[href*='contact.html']").forEach(function (link) {
      link.addEventListener("click", function () {
        pushEvent("quote_cta_click", {
          link_text: link.textContent.trim(),
          link_url: link.href,
          href: link.getAttribute("href")
        });
      });
    });
  }

  function addChatStyles() {
    if (document.getElementById("casa4-chat-styles")) return;

    var style = document.createElement("style");
    style.id = "casa4-chat-styles";
    style.textContent = [
      ".casa4-chat{position:fixed;right:18px;bottom:18px;z-index:9999;font-family:Arial,sans-serif;color:#1f2933}",
      ".casa4-chat *{box-sizing:border-box}",
      ".casa4-chat-toggle{border:0;border-radius:999px;background:#5f9f4f;color:#fff;padding:14px 18px;font-weight:800;font-size:15px;box-shadow:0 12px 30px rgba(0,0,0,.24);cursor:pointer}",
      ".casa4-chat-toggle:focus,.casa4-chat button:focus,.casa4-chat input:focus,.casa4-chat textarea:focus,.casa4-chat select:focus{outline:3px solid rgba(95,159,79,.35);outline-offset:2px}",
      ".casa4-chat-panel{display:none;width:min(360px,calc(100vw - 28px));max-height:min(640px,calc(100vh - 96px));background:#fff;border:1px solid rgba(31,41,51,.14);border-radius:14px;box-shadow:0 20px 55px rgba(0,0,0,.28);overflow:hidden}",
      ".casa4-chat.is-open .casa4-chat-panel{display:block}",
      ".casa4-chat.is-open .casa4-chat-toggle{display:none}",
      ".casa4-chat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:#2f3a43;color:#fff;padding:16px}",
      ".casa4-chat-title{font-size:16px;font-weight:800;margin:0 0 4px}",
      ".casa4-chat-subtitle{font-size:13px;line-height:1.35;opacity:.88;margin:0}",
      ".casa4-chat-close{border:0;background:transparent;color:#fff;font-size:24px;line-height:1;cursor:pointer;padding:0}",
      ".casa4-chat-body{padding:14px;overflow:auto;max-height:calc(min(640px,100vh - 96px) - 74px)}",
      ".casa4-chat-msg{border-radius:12px;padding:10px 12px;margin:0 0 10px;font-size:14px;line-height:1.4}",
      ".casa4-chat-msg.bot{background:#f1f5f0}",
      ".casa4-chat-msg.user{background:#e8f1e4;margin-left:34px}",
      ".casa4-chat-options{display:grid;gap:8px;margin:10px 0 12px}",
      ".casa4-chat-option{border:1px solid rgba(95,159,79,.4);background:#fff;color:#23411f;border-radius:999px;padding:10px 12px;text-align:left;font-weight:700;cursor:pointer}",
      ".casa4-chat-option:hover{background:#f1f8ee}",
      ".casa4-chat-form{display:grid;gap:9px;margin-top:12px}",
      ".casa4-chat-form label{font-size:12px;font-weight:800;color:#334155}",
      ".casa4-chat-form input,.casa4-chat-form textarea,.casa4-chat-form select{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:10px;font:inherit;font-size:14px}",
      ".casa4-chat-form textarea{min-height:72px;resize:vertical}",
      ".casa4-chat-submit{border:0;border-radius:999px;background:#5f9f4f;color:#fff;padding:12px 14px;font-weight:800;cursor:pointer}",
      ".casa4-chat-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}",
      ".casa4-chat-link{display:flex;justify-content:center;align-items:center;text-decoration:none;border-radius:999px;padding:10px 8px;font-weight:800;font-size:13px;background:#2f3a43;color:#fff}",
      ".casa4-chat-link.alt{background:#5f9f4f}",
      ".casa4-chat-status{display:none;margin:8px 0 0;font-size:13px;font-weight:700}",
      "@media(max-width:480px){.casa4-chat{right:12px;bottom:12px}.casa4-chat-panel{width:calc(100vw - 24px)}.casa4-chat-actions{grid-template-columns:1fr}}"
    ].join("");
    document.head.appendChild(style);
  }

  function chatMessage(text, type) {
    var message = document.createElement("div");
    message.className = "casa4-chat-msg " + (type || "bot");
    message.textContent = text;
    return message;
  }

  function createOption(label, action) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "casa4-chat-option";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function buildChatLeadMessage(reason, userMessage) {
    return [
      "Chat assistant lead request",
      "",
      "Visitor selected: " + reason,
      userMessage ? "Question / details: " + userMessage : "",
      "",
      "Please contact this person about their project."
    ].filter(Boolean).join("\n");
  }

  async function submitChatLead(form, reason) {
    var data = new FormData(form);
    var payload = Object.assign({
      name: cleanChatValue(data.get("name")),
      phone: cleanChatValue(data.get("phone")),
      email: cleanChatValue(data.get("email")),
      postcode: cleanChatValue(data.get("postcode")),
      service: cleanChatValue(data.get("service")) || "Chat enquiry",
      timeframe: "Chat callback request",
      message: buildChatLeadMessage(reason, cleanChatValue(data.get("message"))),
      source: "chat-widget",
      page: window.location.href
    }, getAttribution());

    if (!payload.name || !payload.phone) {
      throw new Error("Please add your name and phone number.");
    }

    var response = await fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    var result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Chat lead capture is not configured.");
    }

    pushEvent("chat_lead", {
      service: payload.service,
      form_source: "chat-widget",
      source: "chat-widget",
      chat_reason: reason
    });
  }

  function cleanChatValue(value) {
    return String(value || "").trim();
  }

  function showChatForm(messages, reason) {
    var existing = messages.querySelector(".casa4-chat-form");
    if (existing) existing.remove();

    var form = document.createElement("form");
    form.className = "casa4-chat-form";
    form.innerHTML = [
      "<label>Name *</label><input name=\"name\" autocomplete=\"name\" required>",
      "<label>Phone *</label><input name=\"phone\" type=\"tel\" autocomplete=\"tel\" required>",
      "<label>Email</label><input name=\"email\" type=\"email\" autocomplete=\"email\">",
      "<label>Postcode / area</label><input name=\"postcode\" autocomplete=\"postal-code\" placeholder=\"e.g. Fareham, PO16\">",
      "<label>Service</label><select name=\"service\"><option>Driveways</option><option>Patios</option><option>Landscaping</option><option>Porcelain driveways</option><option>Outdoor kitchens</option><option>Fencing or decking</option><option>General enquiry</option></select>",
      "<label>Question or project details</label><textarea name=\"message\" placeholder=\"Tell us what you need help with\"></textarea>",
      "<button class=\"casa4-chat-submit\" type=\"submit\">Send To Human Advisor</button>",
      "<p class=\"casa4-chat-status\" data-chat-status></p>"
    ].join("");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var button = form.querySelector("button[type='submit']");
      var status = form.querySelector("[data-chat-status]");
      button.disabled = true;
      button.textContent = "Sending...";
      status.style.display = "none";

      try {
        await submitChatLead(form, reason);
        messages.appendChild(chatMessage("Thanks, that has been sent. A human advisor can follow up with you shortly.", "bot"));
        form.remove();
      } catch (error) {
        status.style.display = "block";
        status.style.color = "#b91c1c";
        status.textContent = error.message;
        button.disabled = false;
        button.textContent = "Send To Human Advisor";
      }
    });

    messages.appendChild(form);
    form.querySelector("input[name='name']").focus();
  }

  function addChatWidget() {
    if (document.getElementById("casa4-chat")) return;
    if (window.location.pathname.indexOf("/privacy") === 0) return;

    addChatStyles();

    var widget = document.createElement("div");
    widget.id = "casa4-chat";
    widget.className = "casa4-chat";
    widget.innerHTML = [
      "<button class=\"casa4-chat-toggle\" type=\"button\" aria-expanded=\"false\">Need help?</button>",
      "<section class=\"casa4-chat-panel\" aria-label=\"Casa4 chat assistant\">",
      "<div class=\"casa4-chat-head\"><div><p class=\"casa4-chat-title\">Casa4 Assistant</p><p class=\"casa4-chat-subtitle\">Quick answers, quotes and human callback requests.</p></div><button class=\"casa4-chat-close\" type=\"button\" aria-label=\"Close chat\">&times;</button></div>",
      "<div class=\"casa4-chat-body\"><div data-chat-messages></div><div class=\"casa4-chat-options\" data-chat-options></div><div class=\"casa4-chat-actions\"><a class=\"casa4-chat-link\" href=\"tel:01489290012\">Call</a><a class=\"casa4-chat-link alt\" href=\"https://wa.me/447900281011\">WhatsApp</a><a class=\"casa4-chat-link\" href=\"sms:07900281011\">Text</a></div></div>",
      "</section>"
    ].join("");

    document.body.appendChild(widget);

    var toggle = widget.querySelector(".casa4-chat-toggle");
    var close = widget.querySelector(".casa4-chat-close");
    var messages = widget.querySelector("[data-chat-messages]");
    var options = widget.querySelector("[data-chat-options]");

    function openChat() {
      widget.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      pushEvent("chat_open", { source: "chat-widget" });
    }

    function closeChat() {
      widget.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    function answer(label, text, wantsForm) {
      messages.appendChild(chatMessage(label, "user"));
      messages.appendChild(chatMessage(text, "bot"));
      pushEvent("chat_question", { chat_question: label, source: "chat-widget" });
      if (wantsForm) {
        showChatForm(messages, label);
      }
      messages.parentNode.scrollTop = messages.parentNode.scrollHeight;
    }

    messages.appendChild(chatMessage("Hi, I can help with services, areas, finance and free quote requests. For anything detailed, send it to a human advisor.", "bot"));
    options.appendChild(createOption("Get a free quote", function () {
      answer("Get a free quote", "No problem. Send your details and a human advisor can follow up about the project.", true);
    }));
    options.appendChild(createOption("Do you cover my area?", function () {
      answer("Do you cover my area?", "Casa4 covers Fareham, Portsmouth, Southampton, Hampshire and nearby areas. For Poole or Dorset porcelain enquiries, send the postcode and the team can confirm.", true);
    }));
    options.appendChild(createOption("What services do you do?", function () {
      answer("What services do you do?", "Main services include driveways, block paving, patios, porcelain surfaces, landscaping, outdoor kitchens, fencing, decking, pergolas, kitchens, bathrooms and extensions.", false);
    }));
    options.appendChild(createOption("Finance options", function () {
      answer("Finance options", "The site advertises 0% finance options. A human advisor can confirm what is available for your project and quote size.", true);
    }));
    options.appendChild(createOption("Wait for a human advisor", function () {
      answer("Wait for a human advisor", "Sure. Leave your contact details and what you need help with.", true);
    }));

    toggle.addEventListener("click", openChat);
    close.addEventListener("click", closeChat);
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadTrackingConfig();
    prefillServiceFromUrl();
    addChatWidget();
    trackClicks();
    if (!pageTracked) {
      pageTracked = true;
      pushEvent("page_view", {});
    }

    document.querySelectorAll("form[data-lead-form]").forEach(function (form) {
      ensureMarketingConsentField(form);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitLead(form);
      });
    });
  });
})();
