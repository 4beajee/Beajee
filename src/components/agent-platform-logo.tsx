import Image from "next/image";
import type { AgentPlatformValue } from "@/lib/agent-platform";

const OFFICIAL_ASSETS: Partial<Record<AgentPlatformValue, string>> = {
  open_claw: "/agent-platforms/openclaw.svg",
  nemo_claw: "/agent-platforms/openclaw.svg",
  zero_claw: "/agent-platforms/openclaw.svg",
  nano_claw: "/agent-platforms/openclaw.svg",
  hermes: "/agent-platforms/hermes.svg",
  cursor: "/agent-platforms/cursor.png",
  perplexity_personal_computer: "/agent-platforms/perplexity-cropped.png",
  folk: "/agent-platforms/folk.png",
};

function AssetLogo({ platform, src }: { platform: AgentPlatformValue; src: string }) {
  const isHermes = platform === "hermes";
  const largerMark = platform === "cursor" || platform === "folk" || platform === "perplexity_personal_computer";
  return (
    <span className={isHermes ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white p-[3px]" : "contents"}>
      <Image
        src={src}
        alt=""
        width={largerMark ? 32 : 24}
        height={largerMark ? 32 : 24}
        unoptimized
        className={`${isHermes ? "h-full w-full" : largerMark ? "h-8 w-8 shrink-0" : "h-6 w-6 shrink-0"} object-contain ${platform === "folk" || platform === "cursor" ? "rounded-md" : "rounded-[5px]"}`}
      />
    </span>
  );
}

export function AgentPlatformLogo({ platform }: { platform: AgentPlatformValue }) {
  const asset = OFFICIAL_ASSETS[platform];
  if (asset) return <AssetLogo platform={platform} src={asset} />;

  if (platform === "codex") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <rect width="24" height="24" rx="4.5" fill="#fff" />
        <path
          d="M9.064 3.344a4.578 4.578 0 0 1 2.285-.312c1 .115 1.891.54 2.673 1.275a.09.09 0 0 0 .08.021 4.55 4.55 0 0 1 3.046.275l.163.079A4.581 4.581 0 0 1 19.5 7.081c.37.904.415 1.844.171 2.818a.123.123 0 0 0 .03.115 4.53 4.53 0 0 1 1.183 2.17c.289 1.425-.007 2.71-.887 3.854a4.55 4.55 0 0 1-2.337 1.554.123.123 0 0 0-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 0 0-.105-.024c-.388.125-.78.143-1.204.138a4.54 4.54 0 0 1-3.555-1.801 4.53 4.53 0 0 1-.798-3.915.124.124 0 0 0-.021-.104 4.47 4.47 0 0 1-1.285-2.843 5.19 5.19 0 0 1 .141-1.6c.337-1.112.982-1.985 1.933-2.618.4-.266.816-.464 1.247-.59a.098.098 0 0 0 .065-.066 4.51 4.51 0 0 1 .829-1.615 4.535 4.535 0 0 1 1.837-1.388Zm3.482 10.565a.637.637 0 0 0 0 1.272h3.636a.637.637 0 1 0 0-1.272h-3.636ZM8.462 9.23a.637.637 0 0 0-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 1 0 1.095.649l1.454-2.455a.636.636 0 0 0 .005-.64L8.462 9.23Z"
          fill="url(#codex-gradient)"
        />
        <defs>
          <linearGradient id="codex-gradient" x1="12" x2="12" y1="3" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B1A7FF" />
            <stop offset=".5" stopColor="#7A9DFF" />
            <stop offset="1" stopColor="#3941FF" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (platform === "claude_code") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <path d="M21 11h3v3h-3v3h-1.5v3H18v-3h-1.5v3H15v-3H9v3H7.5v-3H6v3H4.5v-3H3v-3H0v-3h3V5h18v6ZM6 11h1.5V8H6v3Zm10.5 0H18V8h-1.5v3Z" fill="#d97757" />
      </svg>
    );
  }

  if (platform === "manus") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white" fill="currentColor" aria-hidden="true">
        <path d="M8.047 1.163A.936.936 0 1 1 9.863.709c.063.256.132.508.2.76.158.585.319 1.173.421 1.787a.936.936 0 1 1-1.847.305c-.085-.517-.203-.949-.346-1.475-.075-.274-.157-.573-.244-.923ZM3.67 2.753a.936.936 0 0 0 .428 1.252c.667.327 1.245.65 1.818 1.295a.936.936 0 0 0 1.4-1.242C6.5 3.138 5.66 2.687 4.922 2.325a.936.936 0 0 0-1.252.428Zm10.407-2.149a.936.936 0 0 1 .315 1.285c-.355.584-.561 1.181-.786 2.081a.936.936 0 1 1-1.816-.454c.243-.971.504-1.778 1.002-2.598a.936.936 0 0 1 1.285-.314Z" />
        <path fillRule="evenodd" d="M15.672 21.284c-.17-.036-.356-.075-.546-.117-.7-.152-1.65-.365-2.097-.513-.446-.167-1.412-.344-2.888-.742-.578-.176-1.294-.437-1.903-.862-.638-.446-1.364-1.232-1.404-2.412a5.024 5.024 0 0 1 .009-.51 2.716 2.716 0 0 1-.65-1.24 2.632 2.632 0 0 1 .03-1.275c.083-.317.21-.594.316-.8.036-.07.073-.14.11-.206-.35-.111-.747-.248-1.133-.412-.503-.215-1.218-.57-1.752-1.141a2.798 2.798 0 0 1-.71-1.327 2.55 2.55 0 0 1 .226-1.68c.604-1.208 1.757-1.635 2.782-1.672.926-.033 1.912.226 2.795.536.804.282 1.955.807 2.933 1.264.322-.529.747-1.126 1.149-1.608l.172-.179a3.43 3.43 0 0 1 2.06-.887 3.559 3.559 0 0 1 1.118.088l.208.058.19.102c.964.516 1.238 1.406 1.31 1.876a2.9 2.9 0 0 1-.011.926l-.3 1.19c-.058.292-.065.459-.062.547.004.118.023.158.17.371.1.15.221.321.376.562.623.97.684 1.902.68 2.499l.238.078.256.081c.076.024.173.056.267.09.11-.202.407-.636.945-.636.702 0 .99.987.99.987.275 1.838-.98 8.013-2.794 9.164-1.386.88-2.413-.427-3.176-2.437Zm-6.952-8.416c.118-.119.47-.37 1.136-.445a4.337 4.337 0 0 1 2.228.365c.623.276 1.053.908 1.233 1.667.088.371.104.731.066 1.025-.04.31-.128.465-.169.511-.05.058-.228.157-.721.053a3.417 3.417 0 0 1-.764-.266.936.936 0 0 0-.867 1.659 4.9 4.9 0 0 0 1.242.437c.615.13 1.75.23 2.52-.652.37-.424.548-.98.615-1.501a4.789 4.789 0 0 0-.1-1.697c-.268-1.128-.976-2.362-2.297-2.948a6.208 6.208 0 0 0-3.195-.513c-.619.07-1.211.242-1.69.504-1.184-.338-3.556-1.01-2.976-2.17.44-.88 1.643-.807 3.275-.234.864.303 2.188.924 3.697 1.625.693-.832.962-1.29 1.2-1.695.163-.278.312-.53.598-.894.642-.567 1.389-.36 1.389-.36.427.228.318.806.318.806l-.296 1.178c-.284 1.386.03 1.845.547 2.6.09.133.188.275.29.433.412.643.392 1.26.377 1.765-.01.324-.019.602.09.809.224.425 1.06.69 1.943.972-.425 1.36-.663 2.81-1.827 3.223-.632.225-1.263.214-1.71.156-.786-.17-1.716-.379-2.066-.495-.363-.135-.871-.25-1.424-.377-1.316-.3-2.883-.656-3.331-1.462a.975.975 0 0 1-.125-.447c-.026-.74.234-1.404.234-1.404s-.403.002-.685-.27a.853.853 0 0 1-.238-.431c-.03-.13-.042-.28-.025-.44 0-.234.234-.702.702-1.17Z" clipRule="evenodd" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2-10 5 10 5 10-5-10-5Z" />
      <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
    </svg>
  );
}
