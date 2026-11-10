import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmProducts = defineTool({
  name: "list_crm_products",
  title: "List CRM Products",
  description: "List products and services in the CRM catalog with their pricing and SKU.",
  inputSchema: {
    search: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb.from("crm_products").select("*").eq("user_id", userId).order("name");
    if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`);

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});

export const manageCrmProducts = defineTool({
  name: "manage_crm_products",
  title: "Manage CRM Products",
  description: "Add, update, or remove products and services from the price catalog.",
  inputSchema: {
    action: z.enum(["create", "update", "delete"]),
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(300).optional(),
    sku: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
    price: z.number().min(0).optional(),
    currency: z.string().max(8).optional(),
    type: z.enum(["product", "service"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    if (args.action === "create") {
      if (!args.name) throw new ToolError("Product name is required");
      const { data, error } = await sb
        .from("crm_products")
        .insert({
          user_id: userId,
          name: args.name,
          sku: args.sku ?? null,
          description: args.description ?? null,
          price: args.price ?? 0,
          currency: args.currency ?? "USD",
          type: args.type ?? "product",
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Created product "${args.name}" (${data.id})` }], structuredContent: { product: data } };
    }

    if (args.action === "update") {
      if (!args.id) throw new ToolError("Product ID is required");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(args)) {
        if (k !== "action" && k !== "id" && v !== undefined) patch[k] = v;
      }
      const { data, error } = await sb.from("crm_products").update(patch).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated product ${args.id}` }], structuredContent: { product: data } };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("Product ID is required");
      const { error } = await sb.from("crm_products").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted product ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});

export const listCrmQuotes = defineTool({
  name: "list_crm_quotes",
  title: "List CRM Quotes",
  description: "List generated price quotes with status (draft/sent/accepted/rejected), client info, and valid dates.",
  inputSchema: {
    status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
    contact_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb
      .from("crm_quotes")
      .select("*, contacts(first_name, last_name, email, company), crm_deals(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (args.status) q = q.eq("status", args.status);
    if (args.contact_id) q = q.eq("contact_id", args.contact_id);

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { quotes: data ?? [] },
    };
  },
});

export const manageCrmQuotes = defineTool({
  name: "manage_crm_quotes",
  title: "Manage CRM Quotes",
  description: "Create a quote, add/remove line items from a quote, update status (draft/sent/accepted/rejected), or delete a quote.",
  inputSchema: {
    action: z.enum(["create", "update", "add_item", "delete_item", "delete"]),
    id: z.string().uuid().optional().describe("Quote ID (for update, add_item, delete)"),
    item_id: z.string().uuid().optional().describe("Quote Item ID (for delete_item)"),
    title: z.string().max(300).optional(),
    status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
    valid_until: z.string().optional(),
    notes: z.string().max(5000).optional(),
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    item_name: z.string().max(300).optional().describe("Item name when adding a line item"),
    item_description: z.string().max(2000).optional(),
    item_qty: z.number().min(0).optional(),
    item_unit_price: z.number().min(0).optional(),
    item_discount_pct: z.number().min(0).max(100).optional(),
    product_id: z.string().uuid().optional().describe("Product ID from catalog to link item"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    if (args.action === "create") {
      if (!args.title) throw new ToolError("Quote title is required");
      const { data, error } = await sb
        .from("crm_quotes")
        .insert({
          user_id: userId,
          title: args.title,
          status: args.status ?? "draft",
          contact_id: args.contact_id ?? null,
          deal_id: args.deal_id ?? null,
          valid_until: args.valid_until ?? null,
          notes: args.notes ?? null,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Quote created (${data.id})` }], structuredContent: { quote: data } };
    }

    if (args.action === "update") {
      if (!args.id) throw new ToolError("Quote ID is required");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.title !== undefined) patch.title = args.title;
      if (args.status !== undefined) patch.status = args.status;
      if (args.valid_until !== undefined) patch.valid_until = args.valid_until;
      if (args.notes !== undefined) patch.notes = args.notes;
      if (args.contact_id !== undefined) patch.contact_id = args.contact_id;
      if (args.deal_id !== undefined) patch.deal_id = args.deal_id;
      const { data, error } = await sb.from("crm_quotes").update(patch).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated quote ${args.id}` }], structuredContent: { quote: data } };
    }

    if (args.action === "add_item") {
      if (!args.id) throw new ToolError("Quote ID is required");
      if (!args.item_name) throw new ToolError("item_name is required");
      const { data, error } = await sb
        .from("crm_quote_items")
        .insert({
          quote_id: args.id,
          product_id: args.product_id ?? null,
          name: args.item_name,
          description: args.item_description ?? null,
          qty: args.item_qty ?? 1,
          unit_price: args.item_unit_price ?? 0,
          discount_pct: args.item_discount_pct ?? 0,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Added line item to quote ${args.id}` }], structuredContent: { item: data } };
    }

    if (args.action === "delete_item") {
      if (!args.item_id) throw new ToolError("item_id is required");
      const { error } = await sb.from("crm_quote_items").delete().eq("id", args.item_id);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted quote item ${args.item_id}` }], structuredContent: { ok: true } };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("Quote ID is required");
      const { error } = await sb.from("crm_quotes").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted quote ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
