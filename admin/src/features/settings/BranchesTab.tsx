import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Building2, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, FormRow, FormSheet, Grid, StatTile } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { branchesStore, type Branch } from '../../services/settings';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import { isPhone, makeSettingsStyles } from './formParts';

export default function BranchesTab() {
  return <WithStore store={branchesStore}>{(rows, setRows) => <Branches rows={rows} setRows={setRows} />}</WithStore>;
}

function Branches({ rows, setRows }: { rows: Branch[]; setRows: (rows: Branch[]) => void }) {
  const { showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols } = useResponsive();
  const [city, setCity] = useState('All cities');
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const [toggling, setToggling] = useState<Branch | null>(null);
  const [removing, setRemoving] = useState<Branch | null>(null);

  const cities = ['All cities', ...Array.from(new Set(rows.map((b) => b.city))).sort()];
  const filtered = useMemo(() => rows.filter((b) => city === 'All cities' || b.city === city), [rows, city]);
  const list = useListControls(filtered, {
    search: (b) => `${b.name} ${b.city} ${b.address} ${b.manager}`,
    sorts: {
      Name: (a, b) => a.name.localeCompare(b.name),
      City: (a, b) => a.city.localeCompare(b.city),
      'Active first': (a, b) => Number(b.active) - Number(a.active),
    },
    pageSize: 6,
  });

  return (
    <View>
      <Grid cols={cols(2, 3, 3)}>
        <StatTile label="Branches" value={rows.length} tone="primary" icon={(c) => <Building2 size={16} color={c} />} />
        <StatTile label="Active" value={rows.filter((b) => b.active).length} tone="success" icon={(c) => <MapPin size={16} color={c} />} />
        <StatTile label="Cities" value={cities.length - 1} tone="info" icon={(c) => <Users size={16} color={c} />} />
      </Grid>
      <View style={[styles.toolbar, { marginTop: 16 }]}>
        <Text style={styles.meta}>
          {list.total} of {rows.length} shown
        </Text>
        <Button label="Add branch" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setEditing('new')} />
      </View>
      <ListToolbar controls={list} placeholder="Search name, address or manager" filters={<ChipGroup options={cities} value={city} onChange={setCity} scroll />} />
      {list.total === 0 ? (
        <Card>
          <EmptyState title="No branches" message="Nothing matches this search or city." icon={(c) => <Building2 size={22} color={c} />} action={<Button label="Add branch" size="sm" onPress={() => setEditing('new')} />} />
        </Card>
      ) : (
        <Grid cols={cols(1, 2, 2)} gap={16}>
          {list.pageRows.map((b) => (
            <Card key={b.id} style={!b.active && { opacity: 0.8 }}>
              <View style={styles.rowHead}>
                <Text style={[styles.title, { flex: 1 }]}>{b.name}</Text>
                <Badge label={b.city} tone="info" />
                <Badge label={b.active ? 'Active' : 'Inactive'} tone={b.active ? 'success' : 'neutral'} />
              </View>
              <Text style={styles.body}>{b.address}</Text>
              <Text style={[styles.meta, { marginTop: 6 }]}>
                {b.phone} · Manager: {b.manager}
              </Text>
              <View style={styles.actions}>
                <Button label="Edit" size="sm" variant="outline" icon={(c) => <Pencil size={12} color={c} />} onPress={() => setEditing(b)} />
                <Button label={b.active ? 'Deactivate' : 'Activate'} size="sm" variant="ghost" onPress={() => setToggling(b)} />
                <Button label="Delete" size="sm" variant="danger" icon={(c) => <Trash2 size={12} color={c} />} onPress={() => setRemoving(b)} />
              </View>
            </Card>
          ))}
        </Grid>
      )}
      <Pager controls={list} />

      {editing ? (
        <BranchSheet
          branch={editing === 'new' ? null : editing}
          rows={rows}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            setRows(rows.some((x) => x.id === b.id) ? rows.map((x) => (x.id === b.id ? b : x)) : [...rows, b]);
            showToast(`${b.name} saved`);
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!toggling}
        title={toggling?.active ? `Deactivate ${toggling.name}?` : `Activate ${toggling?.name}?`}
        message={toggling?.active ? 'The branch stays on record but is marked as closed.' : 'The branch is marked as open again.'}
        confirmLabel={toggling?.active ? 'Deactivate' : 'Activate'}
        danger={toggling?.active}
        onCancel={() => setToggling(null)}
        onConfirm={() => {
          if (toggling) setRows(rows.map((b) => (b.id === toggling.id ? { ...b, active: !b.active } : b)));
          setToggling(null);
        }}
      />
      <ConfirmDialog
        visible={!!removing}
        title={`Delete ${removing?.name}?`}
        message="The branch is removed from this list. Deactivate it instead if you may reopen it."
        confirmLabel="Delete branch"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            setRows(rows.filter((b) => b.id !== removing.id));
            showToast(`${removing.name} deleted`);
          }
          setRemoving(null);
        }}
      />
    </View>
  );
}

function BranchSheet({ branch, rows, onClose, onSave }: { branch: Branch | null; rows: Branch[]; onClose: () => void; onSave: (b: Branch) => void }) {
  const [name, setName] = useState(branch?.name ?? '');
  const [city, setCity] = useState(branch?.city ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [manager, setManager] = useState(branch?.manager ?? '');
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? 'Branch name is required' : rows.some((b) => b.id !== branch?.id && b.name.toLowerCase() === name.trim().toLowerCase()) ? 'A branch with this name already exists' : undefined;
  const cityError = !city.trim() ? 'City is required' : undefined;
  const addressError = !address.trim() ? 'Address is required' : undefined;
  const phoneError = !isPhone(phone) ? 'Enter a valid phone number' : undefined;
  const managerError = !manager.trim() ? 'Manager is required' : undefined;

  const submit = () => {
    setTouched(true);
    if (nameError || cityError || addressError || phoneError || managerError) return;
    onSave({ id: branch?.id ?? `BR-${Date.now()}`, name: name.trim(), city: city.trim(), address: address.trim(), phone: phone.trim(), manager: manager.trim(), active: branch?.active ?? true });
  };

  return (
    <FormSheet
      visible
      title={branch ? 'Edit branch' : 'Add branch'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save branch" onPress={submit} />
        </>
      }>
      <FormRow>
        <Field label="Branch name" required value={name} onChangeText={setName} error={touched ? nameError : undefined} />
        <Field label="City" required value={city} onChangeText={setCity} error={touched ? cityError : undefined} />
      </FormRow>
      <Field label="Address" required multiline value={address} onChangeText={setAddress} error={touched ? addressError : undefined} />
      <FormRow>
        <Field label="Phone" required value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={touched ? phoneError : undefined} />
        <Field label="Manager" required value={manager} onChangeText={setManager} error={touched ? managerError : undefined} />
      </FormRow>
    </FormSheet>
  );
}
