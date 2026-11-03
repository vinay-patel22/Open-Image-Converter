import { GithubIcon } from "./ui/github-icon";

/**
 * Header — Minimal, clean design with text logo, centered tag, and GitHub link
 */
const GITHUB_URL = "https://github.com/vinay-patel22";

export function Header() {
  return (
    <header className="border-b border-border bg-white/90 backdrop-blur-sm flex-shrink-0">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">Open Image Converter</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <span>100% Local</span>
          <span className="text-primary">•</span>
          <span>Free</span>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the GitHub repository"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground focus-visible:outline-none"
        >
          <GithubIcon className="h-5 w-5" aria-hidden />
        </a>
      </div>
    </header>
  );
}
