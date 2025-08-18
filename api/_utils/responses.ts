export function json(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  export function bad(message = "Bad request"): Response {
    return json({ error: message }, 400);
  }
  
  export function unauthorized(message = "Unauthorized"): Response {
    return json({ error: message }, 401);
  }
  
  export function forbidden(message = "Forbidden"): Response {
    return json({ error: message }, 403);
  }
  
  export function notFound(message = "Not found"): Response {
    return json({ error: message }, 404);
  }
  
  export function serverError(message = "Internal Server Error"): Response {
    return json({ error: message }, 500);
  }
  