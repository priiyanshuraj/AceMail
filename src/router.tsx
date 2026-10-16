import { QueryClient } from "@tanstack/react-query";
import { createRouter, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const offline = error instanceof TypeError && /fetch/i.test(error.message);
  return (
    <div className="mx-auto max-w-md space-y-3 p-10 text-center">
      <h2 className="text-xl font-semibold">{offline ? "Connection interrupted" : "Something went wrong"}</h2>
      <p className="text-sm text-muted-foreground">
        {offline ? "The page couldn't reach the server for a moment. Please try again." : error instanceof Error ? error.message : "Please try again."}
      </p>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        onClick={() => { reset(); router.invalidate(); }}
      >
        Try again
      </button>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: (count, err) => count < 2 && err instanceof TypeError } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultError,
  });

  return router;
};
