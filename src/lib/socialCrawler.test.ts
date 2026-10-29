import { describe, expect, it } from 'vitest';
import { defaultPresenterSettings, generatePresenterBlueprint } from './aiPresenter';
import type { CrawlerStoryItem } from './crawler.types';

describe('generatePresenterBlueprint with crawler stories', () => {
  it('uses crawler stories to enrich the source feed and preview poll', () => {
    const stories: CrawlerStoryItem[] = [
      {
        id: 'tw-1',
        platform: 'twitter',
        category: 'Sports Update',
        headline: 'World Cup buzz is climbing across Africa',
        summary: 'Football fans are reacting to the latest tournament build-up.',
        source: 'Twitter',
        angle: 'Build a sports segment around fan excitement and next-match talk.',
        pollSuggestion: 'Poll: Who do you think will win the next big match?',
      },
    ];

    const blueprint = generatePresenterBlueprint(defaultPresenterSettings, stories);

    expect(blueprint.sourceFeed[0].headline).toContain('World Cup');
    expect(blueprint.preview.pollPrompt).toContain('Poll');
    expect(blueprint.showPlanner.selectedTopics[0]).toContain('World Cup');
  });

  it('gives politics a longer slot and adds the weekly Outlook interview segment', () => {
    const blueprint = generatePresenterBlueprint(defaultPresenterSettings);
    const politics = blueprint.segments.find((segment) => segment.category === 'Politics');
    const outlook = blueprint.segments.find((segment) => segment.category === 'The Outlook');

    expect(politics?.timeSlot.duration).toBe(45);
    expect(outlook?.title).toContain('The Outlook');
    expect(outlook?.guest).toContain('guest');
  });
});
