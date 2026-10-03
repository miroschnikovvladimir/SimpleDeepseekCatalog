import type { ReactNode } from "react";
import { labels } from "./catalog";
import type { StoryModule } from "./catalog";

export function StoryModuleDetails({ item, image, action }: { item: StoryModule; image: ReactNode; action: ReactNode }) {
  return <article className="story-module">
    <header className="story-module-heading">
      <div><p className="eyebrow">{labels[item.type]}</p><h3>{item.title}</h3></div>
      {action}
    </header>
    <div className={`story-module-body ${image ? "" : "without-image"}`}>
      {image}
      <div className="story-module-description">
        {(item.preview_description || item.description).split(/\n\s*\n/).map((paragraph, index) => <p className="long-copy" key={index}>{paragraph}</p>)}
      </div>
    </div>
  </article>;
}
