function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}

function clean(value) {
  return String(value || "").trim();
}

export function onRequestGet(context) {
  var env = context.env || {};

  return jsonResponse({
    gtmContainerId: clean(env.GTM_CONTAINER_ID),
    gaMeasurementId: clean(env.GA_MEASUREMENT_ID),
    clarityProjectId: clean(env.CLARITY_PROJECT_ID)
  });
}
