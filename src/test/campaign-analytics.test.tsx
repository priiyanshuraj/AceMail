import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CampaignAnalytics } from "@/components/CampaignAnalytics";

describe("Campaign analytics", () => {
  it("shows totals, recipient activity, filters and refresh", () => {
    const refresh = vi.fn();
    render(<CampaignAnalytics refreshing={false} refresh={refresh} analytics={{ total: 10, sent: 8, opened: 4, clicked: 2, clickEvents: 3, replied: 1, sentRecipients: 8, queued: 2, paused: 0, failed: 0, activity: [{ kind: "opened", at: "2026-10-10T08:00:00Z", recipient: "open@example.com", destination: null }, { kind: "clicked", at: "2026-10-10T08:10:00Z", recipient: "click@example.com", destination: "https://example.com" }] }} />);
    expect(screen.getByText("50% of sent emails")).toBeTruthy();
    expect(screen.getByText("click@example.com")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Clicks" }));
    fireEvent.click(screen.getByRole("tab", { name: "Clicks" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});