import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-6 text-center">
          <div className="max-w-md">
            <h1 className="text-xl font-bold">Une erreur est survenue</h1>
            <p className="mt-2 text-sm opacity-80">
              Veuillez recharger la page. Si le problème persiste, contactez le
              support.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
