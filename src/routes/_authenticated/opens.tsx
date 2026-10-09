import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listOpenedEmails } from "@/lib/acemail.functions";
import { Card, CardContent } from "@/components/ui/card";
import { MailOpen } from "lucide-react";

const opensQuery = queryOptions({
  queryKey: ["opened-emails"],
  queryFn: () => listOpenedEmails(),
});

export const Route = createFileRoute("/_authenticated/opens")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opensQuery),
  head: () => ({
    meta: [
      { title: "Opens — AceMail" },
      { name: "description", content: "Everyone who opened your emails." },
      { property: "og:title", content: "Opens — AceMail" },
      { property: "og:description", content: "Everyone who opened your emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpensPage,
});

function OpensPage() {
  const { data: opens } = useSuspenseQuery(opensQuery);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Opens</h1>
        <p className="text-sm text-muted-foreground">Everyone who opened your emails, most recent first</p>
      </div>

      {opens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MailOpen className="h-8 w-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No opens yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Once a campaign email is opened, the contact will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {opens.map((log) => {
                  const contact = log.contacts as { email: string; first_name: string | null; last_name: string | null; company: string | null } | null;
                  const campaign = log.campaigns as { name: string } | null;
                  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
                  return (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{name || contact?.email || "Unknown"}</div>
                        {name && <div className="text-xs text-muted-foreground">{contact?.email}</div>}
                        {contact?.company && <div className="text-xs text-muted-foreground">{contact.company}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{campaign?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {log.opened_at ? new Date(log.opened_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
