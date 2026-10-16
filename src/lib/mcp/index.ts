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

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "acemail",
  title: "Acemail",
  version: "0.3.0",
  instructions:
    "Tools for AceMail cold email and LinkedIn outreach. Manage contact lists and contacts (including custom CSV columns that become {{field}} template variables, job title, phone and LinkedIn link), write and spam-check templates, review campaigns and their stats, read inbox replies and the send log, manage the do-not-contact list, and run LinkedIn sequences: list, start or pause them, read and complete daily LinkedIn tasks, mark LinkedIn replies and see activity. Sending email and connecting mailboxes or LinkedIn are done in the AceMail app. Ask the user before deleting contacts.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listContactLists, listContacts, updateContactFields, createContactList, addContacts, deleteContacts,
    listTemplates, saveTemplate, listCampaigns, getCampaignStats, listInbox, listOutbox, manageSuppressions,
    getContactDetail, updateContactProfile,
    listLinkedinSequences, setLinkedinSequenceStatus, listLinkedinTasks, completeLinkedinTask, markLinkedinReplied, getLinkedinActivity,
  ],
});
