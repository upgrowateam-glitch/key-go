import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { CircleHelp } from 'lucide-react-native';
import { EmptyState, PageHeader, Screen } from '../../components/kit';
import { ACCOUNT_SECTIONS } from '../../components/account/sections';
import { useAuth } from '../../services/auth';

/** One page of the customer menu (opened from Profile), e.g. /account/payments. */
export default function AccountSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { customerId } = useAuth();
  if (!customerId) return <Redirect href={'/login' as never} />;
  const page = ACCOUNT_SECTIONS[section ?? ''];
  if (!page) {
    return (
      <Screen>
        <PageHeader title="Not found" back />
        <EmptyState title="This page doesn't exist" message="Go back to Profile to see everything in your account." icon={(c) => <CircleHelp size={22} color={c} />} />
      </Screen>
    );
  }
  const { Body } = page;
  return (
    <Screen bottomInset={48}>
      <PageHeader eyebrow={page.eyebrow} title={page.title} subtitle={page.subtitle} back />
      <Body />
    </Screen>
  );
}
