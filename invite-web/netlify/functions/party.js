exports.handler = async (event) => {
  const id =
    event.queryStringParameters?.id ||
    event.queryStringParameters?.partyId ||
    null;

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify({
      ok: true,
      id,
      note: "Phase 2 smoke test: function is running.",
    }),
  };
};
