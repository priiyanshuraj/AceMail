import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listContactLists from "./tools/list-contact-lists";
import listContacts from "./tools/list-contacts";
import updateContactFields from "./tools/update-contact-fields";
import createContactList from "./tools/create-contact-list";
import addContacts from "./tools/add-contacts";
import deleteContacts from "./tools/delete-contacts";
import listTemplates from "./tools/list-templates";
import saveTemplate from "./tools/save-template";
import listCampaigns from "./tools/list-campaigns";
import getCampaignStats from "./tools/get-campaign-stats";
import listInbox from "./tools/list-inbox";
import listOutbox from "./tools/list-outbox";
import manageSuppressions from "./tools/manage-suppressions";
import {
  listLinkedinSequences, setLinkedinSequenceStatus, listLinkedinTasks, completeLinkedinTask,
  markLinkedinReplied, getLinkedinActivity, getContactDetail, updateContactProfile,
} from "./tools/linkedin";
import { listCrmStages, manageCrmStages } from "./tools/crm-stages";
import { listCrmDeals, manageCrmDeals } from "./tools/crm-deals";
import { listCrmLeads, manageCrmLeads } from "./tools/crm-leads";
import { listCrmActivities, manageCrmActivities } from "./tools/crm-activities";
import { listCrmOrganizations, manageCrmOrganizations } from "./tools/crm-organizations";
import { listCrmProducts, manageCrmProducts, listCrmQuotes, manageCrmQuotes } from "./tools/crm-products-quotes";
import { listCrmCallLogs, manageCrmCallLogs } from "./tools/crm-call-logs";
import { listCrmTasks, manageCrmTasks } from "./tools/crm-tasks";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "acemail",
  title: "Acemail",
  version: "0.5.0",
  instructions:
    "Comprehensive tools for AceMail cold email, LinkedIn outreach, and full CRM suite with Frappe CRM parity. Manage contact lists, contacts, email templates, outreach campaigns, stats, inbox replies, outbox logs, suppressions, LinkedIn sequences/tasks, CRM pipeline stages (add, rename, reorder, delete, migrate), CRM deals (create, update, move stages, value, won/lost reasons), inbound/outbound leads (create, track, convert to deals), phone call logs (inbound/outbound durations and summaries), CRM tasks and priorities, scheduled client activities (calls, meetings, lunches), company organizations, product catalogs, and itemized quotes/proposals.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listContactLists, listContacts, updateContactFields, createContactList, addContacts, deleteContacts,
    listTemplates, saveTemplate, listCampaigns, getCampaignStats, listInbox, listOutbox, manageSuppressions,
    getContactDetail, updateContactProfile,
    listLinkedinSequences, setLinkedinSequenceStatus, listLinkedinTasks, completeLinkedinTask, markLinkedinReplied, getLinkedinActivity,
    listCrmStages, manageCrmStages,
    listCrmDeals, manageCrmDeals,
    listCrmLeads, manageCrmLeads,
    listCrmCallLogs, manageCrmCallLogs,
    listCrmTasks, manageCrmTasks,
    listCrmActivities, manageCrmActivities,
    listCrmOrganizations, manageCrmOrganizations,
    listCrmProducts, manageCrmProducts,
    listCrmQuotes, manageCrmQuotes,
  ],
});
