import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Car, Fuel, Plus, Shapes, Trash2 } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, Grid, Section } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { DEFAULT_LISTS, MASTER_KEY, type MasterItem, type MasterLists } from '../../lib/catalog';
import { categoryOf, readFleetExtras } from '../../services/fleet';
import { useThemeColors, useThemedStyles, withAlpha } from '../../theme';
import { createStore, WithStore } from '../notifications/listControls';
import { makeSettingsStyles } from './formParts';

const listsStore = createStore<MasterLists>(MASTER_KEY, DEFAULT_LISTS);

type ListKey = keyof MasterLists;
const LISTS: { key: ListKey; title: string; hint: string; icon: (c: string) => React.ReactNode; example: string }[] = [
  { key: 'vehicleTypes', title: 'Car types', hint: 'Body type shown to customers, e.g. SUV. Each type has its own deposit in Rental pricing.', icon: (c) => <Car size={18} color={c} />, example: 'e.g. Pickup' },
  { key: 'categories', title: 'Car categories', hint: 'Your price class, e.g. Economy or Premium.', icon: (c) => <Shapes size={18} color={c} />, example: 'e.g. Self-drive Premium' },
  { key: 'fuelTypes', title: 'Fuel types', hint: 'Fuel options when adding a car.', icon: (c) => <Fuel size={18} color={c} />, example: 'e.g. LPG' },
];

/** Settings → Master data: the car type, category and fuel lists used across KeyGo. */
export default function MasterDataTab() {
  return <WithStore store={listsStore}>{(lists, save) => <Lists lists={complete(lists)} save={save} />}</WithStore>;
}

/** A saved document may miss a list that was added later; fill it from the defaults. */
const complete = (l: Partial<MasterLists>): MasterLists => ({
  vehicleTypes: l.vehicleTypes?.length ? l.vehicleTypes : DEFAULT_LISTS.vehicleTypes,
  categories: l.categories?.length ? l.categories : DEFAULT_LISTS.categories,
  fuelTypes: l.fuelTypes?.length ? l.fuelTypes : DEFAULT_LISTS.fuelTypes,
});

function Lists({ lists, save }: { lists: MasterLists; save: (l: MasterLists) => void }) {
  const { vehicles, showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols } = useResponsive();
  const [removing, setRemoving] = useState<{ key: ListKey; name: string } | null>(null);

  // How many cars use each entry; entries in use cannot be deleted, only switched off
  const usage = useMemo(() => {
    const extras = readFleetExtras();
    const count = (pick: (v: (typeof vehicles)[number]) => string) => vehicles.reduce<Record<string, number>>((m, v) => ((m[pick(v)] = (m[pick(v)] ?? 0) + 1), m), {});
    return { vehicleTypes: count((v) => v.type), categories: count((v) => categoryOf(extras, v.id)), fuelTypes: count((v) => v.fuel) } as Record<ListKey, Record<string, number>>;
  }, [vehicles]);

  const update = (key: ListKey, next: MasterItem[], message: string) => {
    save({ ...lists, [key]: next });
    showToast(message);
  };

  return (
    <View>
      <Text style={styles.meta}>
        These lists appear when you add or edit a car, in the fleet filters and in the customer app. Switch off an entry to stop offering it; cars that already use it keep it. An entry can be deleted only when no car uses it.
      </Text>
      <Grid cols={cols(1, 1, 3)} gap={16} style={{ marginTop: 12 }}>
        {LISTS.map((l) => (
          <ListCard
            key={l.key}
            title={l.title}
            hint={l.hint}
            example={l.example}
            icon={l.icon}
            items={lists[l.key]}
            usage={usage[l.key]}
            onAdd={(name) => update(l.key, [...lists[l.key], { name, active: true }], `${name} added to ${l.title.toLowerCase()}`)}
            onToggle={(name) =>
              update(
                l.key,
                lists[l.key].map((i) => (i.name === name ? { ...i, active: !i.active } : i)),
                lists[l.key].find((i) => i.name === name)?.active ? `${name} switched off` : `${name} switched on`
              )
            }
            onRemove={(name) => setRemoving({ key: l.key, name })}
          />
        ))}
      </Grid>
      <ConfirmDialog
        visible={!!removing}
        title={`Delete ${removing?.name}?`}
        message="It is removed from the list. You can add it again later."
        confirmLabel="Delete"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing;
          setRemoving(null);
          if (r) update(r.key, lists[r.key].filter((i) => i.name !== r.name), `${r.name} deleted`);
        }}
      />
    </View>
  );
}

function ListCard({
  title,
  hint,
  example,
  icon,
  items,
  usage,
  onAdd,
  onToggle,
  onRemove,
}: {
  title: string;
  hint: string;
  example: string;
  icon: (c: string) => React.ReactNode;
  items: MasterItem[];
  usage: Record<string, number>;
  onAdd: (name: string) => void;
  onToggle: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeSettingsStyles);
  const [draft, setDraft] = useState('');
  const name = draft.trim().replace(/\s+/g, ' ');
  const error = !name ? '' : name.length > 40 ? 'Use 40 characters or fewer' : items.some((i) => i.name.toLowerCase() === name.toLowerCase()) ? 'Already in the list' : '';
  const add = () => {
    if (!name || error) return;
    onAdd(name);
    setDraft('');
  };

  return (
    <Section title={title} subtitle={hint} style={{ marginTop: 0 }}>
      <Card padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: error ? colors.danger : colors.line, borderRadius: 10, paddingHorizontal: 10, height: 40 }}>
            {icon(colors.muted)}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={add}
              placeholder={`Add new… (${example})`}
              placeholderTextColor={colors.muted}
              accessibilityLabel={`New ${title.toLowerCase()} name`}
              style={{ flex: 1, color: colors.txt, fontSize: 14, height: '100%' }}
            />
          </View>
          <Button label="Add" size="sm" disabled={!name || !!error} icon={(c) => <Plus size={14} color={c} />} onPress={add} />
        </View>
        {error ? <Text style={[styles.meta, { color: colors.danger, paddingHorizontal: 12, paddingTop: 6 }]}>{error}</Text> : null}
        {items.map((i, idx) => {
          const used = usage[i.name] ?? 0;
          return (
            <View key={i.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.line }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.title, !i.active && { color: colors.muted }]} numberOfLines={1}>
                  {i.name}
                </Text>
                <Text style={styles.meta}>{used ? `${used} car${used === 1 ? '' : 's'}` : 'Not used yet'}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: i.active }}
                accessibilityLabel={`${i.name} ${i.active ? 'on' : 'off'}`}
                onPress={() => onToggle(i.name)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: i.active ? withAlpha(colors.success, 0.14) : withAlpha(colors.muted, 0.12) }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: i.active ? colors.success : colors.muted }}>{i.active ? 'On' : 'Off'}</Text>
              </Pressable>
              {used ? (
                <Badge label="In use" tone="neutral" />
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${i.name}`} onPress={() => onRemove(i.name)} hitSlop={8} style={{ padding: 4 }}>
                  <Trash2 size={16} color={colors.danger} />
                </Pressable>
              )}
            </View>
          );
        })}
      </Card>
    </Section>
  );
}
