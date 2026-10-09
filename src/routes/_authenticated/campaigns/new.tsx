import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listContactLists, listTemplates, listEmailConfigs, createCampaign } from "@/lib/acemail.functions";
import { CampaignForm } from "@/components/CampaignForm";
import { toast } from "sonner";

export const wizardDataQuery = queryOptions({
  queryKey: ["campaign-wizard-data"],
  queryFn: async () => {
    const [lists, templates, configs] = await Promise.all([listContactLists(), listTemplates(), listEmailConfigs()]);
    return { lists, templates, configs };
  },
});

export const Route = createFileRoute("/_authenticated/campaigns/new")({
  loader: ({ context }) => context.queryClient.ensureQueryData(wizardDataQuery),
  head: () => ({
    meta: [
      { title: "New campaign — AceMail" },
      { name: "description", content: "Create a multi-step email campaign." },
      { property: "og:title", content: "New campaign — AceMail" },
      { property: "og:description", content: "Create a multi-step email campaign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCampaign,
});

function NewCampaign() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(wizardDataQuery);
  return (
    <CampaignForm
      data={data}
      title="New campaign"
      submitLabel="Create campaign"
      onSubmit={async (values) => {
        try {
          const campaign = await createCampaign({ data: values });
          toast.success("Campaign created — start it when ready");
          navigate({ to: "/campaigns/$campaignId", params: { campaignId: campaign.id } });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to create campaign");
        }
      }}
    />
  );
}
