import { Elysia } from "elysia";

const app = new Elysia().get("/", () => "API running Yoo").listen(3000);

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);
