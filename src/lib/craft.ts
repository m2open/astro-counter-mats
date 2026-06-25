const CRAFT_URL = import.meta.env.CRAFT_GRAPHQL_URL;

export async function craftQuery(query: string, variables = {}) {
  const response = await fetch(CRAFT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors) {
    console.error("Craft GraphQL error:", json.errors);
    throw new Error(json.errors[0].message);
  }

  return json.data;
}