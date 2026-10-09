import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getCampaign, updateCampaign } from "@/lib/acemail.functions";
import { CampaignForm } from "@/components/CampaignForm";
import { wizardDataQuery } from "./new";
import { toast } from "sonner";

const campaignQuery = (id: string) =>
  queryOptions({ queryKey: ["campaign", id], queryFn: () => getCampaign({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/campaigns/edit/$campaignId")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(wizardDataQuery),
      context.queryClient.ensureQueryData(campaignQuery(params.campaignId)),
    ]),
  head: () => ({
    meta: [
      { title: "Edit campaign — AceMail" },
      { name: "description", content: "Change a campaign's audience, sequence, and schedule." },
      { property: "og:title", content: "Edit campaign — AceMail" },
      { property: "og:description", content: "Change a campaign's audience, sequence, and schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditCampaign,
});

function EditCampaign() {
  const { campaignId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(wizardDataQuery);
  const { data: detail } = useSuspenseQuery(campaignQuery(campaignId));
  const c = detail.campaign;
  return (
    <CampaignForm
      data={data}
      title={`Edit: ${c.name}`}
      submitLabel="Save changes"
      initial={{
        name: c.name,
        list_id: c.list_id,
        config_id: c.config_id ?? "",
        send_days: c.send_days,
        send_window_start: c.send_window_start ?? undefined,
        send_window_end: c.send_window_end ?? undefined,
        timezone: c.timezone,
        steps: detail.steps.map((s) => ({
          id: s.id,
          template_id: s.template_id,
          delay_days: s.delay_days,
          step_order: s.step_order,
        })),
      }}
      onSubmit={async (values) => {
        try {
          await updateCampaign({ data: { ...values, id: campaignId } });
          await queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
          queryClient.invalidateQueries({ queryKey: ["campaigns"] });
          toast.success("Campaign updated");
          navigate({ to: "/campaigns/$campaignId", params: { campaignId } });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to update campaign");
        }
      }}
    />
  );
}
