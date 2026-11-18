'use client';

import React, { ComponentType, ReactNode, Suspense } from 'react';
import { ScrollView, View } from 'react-native';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader, PageTabs, SimulatedNote, MAX_CONTENT_WIDTH } from '../kit';
import { findSection } from '../../config/navigation';
import { useResponsive } from '../../hooks/useResponsive';

interface SectionPageProps {
  /** Id from NAV_SECTIONS; supplies the title, description and tab list. */
  section: string;
  /** Component for each tab slug. */
  tabs: Record<string, ComponentType>;
  actions?: ReactNode;
  /** Shown above the tabs when the section depends on an integration that is not connected yet. */
  pendingIntegration?: string;
}

function SectionTabs({ section: id, tabs, actions, pendingIntegration }: SectionPageProps) {
  const { gutter } = useResponsive();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const section = findSection(id)!;
  const labels = section.tabs.map((t) => t.label);
  const activeSlug = section.tabs.find((t) => t.slug === params.get('tab'))?.slug ?? section.tabs[0].slug;
  const active = section.tabs.find((t) => t.slug === activeSlug)!;
  const Tab = tabs[activeSlug];

  const change = (label: string) => {
    const slug = section.tabs.find((t) => t.label === label)!.slug;
    router.replace(`${pathname}?tab=${slug}`);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16 }}>
        <PageHeader title={section.title} subtitle={section.description} actions={actions} />
        {pendingIntegration ? <SimulatedNote>{pendingIntegration}</SimulatedNote> : null}
        <PageTabs tabs={labels} value={active.label} onChange={change} />
        <Tab />
      </View>
    </ScrollView>
  );
}

/** Section page with URL-synced tabs (`?tab=slug`), so every tab can be linked to and survives reload. */
export function SectionPage(props: SectionPageProps) {
  return (
    <Suspense fallback={null}>
      <SectionTabs {...props} />
    </Suspense>
  );
}
