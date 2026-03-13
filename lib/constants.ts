// Call the backend directly from the browser. Override via NEXT_PUBLIC_API_BASE_URL.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://iq8bhm0nf6.execute-api.us-east-1.amazonaws.com/dev/v2";
