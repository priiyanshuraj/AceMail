import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listContactLists from "./tools/list-contact-lists";
import listContacts from "./tools/list-contacts";
import updateContactFields from "./tools/update-contact-fields";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "acemail",
  title: "Acemail",
  version: "0.1.0",
  instructions:
    "Tools for AceMail cold email contacts. Call list_contact_lists to find a list, list_contacts to read rows (including custom CSV columns), then update_contact_fields to write new or changed column values, which become {{field}} variables in templates.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listContactLists, listContacts, updateContactFields],
});
