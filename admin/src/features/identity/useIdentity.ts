import { useCallback, useEffect, useState } from 'react';
import { listIdentity, type IdentityList, type OwnerType } from '../../services/identity';

/** The documents on file for one customer or driver, and what the signed-in person may do with them. */
export function useIdentity(ownerType: OwnerType, ownerId: string) {
  const [data, setData] = useState<IdentityList | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setData(await listIdentity(ownerType, ownerId));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [ownerType, ownerId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

export type IdentityState = ReturnType<typeof useIdentity>;

export interface SlotDef {
  kind: string;
  label: string;
  hint: string;
  /** Photos only (no PDF), e.g. the face photo. */
  photoOnly?: boolean;
  camera: 'user' | 'environment';
  guide?: 'card' | 'face';
}

export const CUSTOMER_SLOTS: SlotDef[] = [
  { kind: 'photo', label: 'Customer photo', hint: 'Taken at the counter, for the face check', photoOnly: true, camera: 'user', guide: 'face' },
  { kind: 'selfie', label: 'Selfie', hint: 'Sent by the customer from the app', photoOnly: true, camera: 'user', guide: 'face' },
  { kind: 'id_front', label: 'ID card (front)', hint: 'Aadhaar, passport or voter ID: the side with the photo', camera: 'environment', guide: 'card' },
  { kind: 'id_back', label: 'ID card (back)', hint: 'Back side (address side of Aadhaar)', camera: 'environment', guide: 'card' },
  { kind: 'dl_front', label: 'Driving licence (front)', hint: 'Side with the photo and licence number', camera: 'environment', guide: 'card' },
  { kind: 'dl_back', label: 'Driving licence (back)', hint: 'Vehicle classes and validity', camera: 'environment', guide: 'card' },
  { kind: 'address_proof', label: 'Address proof', hint: 'Utility bill, rent agreement or bank statement', camera: 'environment' },
];

export const DRIVER_SLOTS: SlotDef[] = [
  { kind: 'photo', label: 'Driver photo', hint: 'Clear photo of the face', photoOnly: true, camera: 'user', guide: 'face' },
  { kind: 'dl_front', label: 'Driving licence (front)', hint: 'Side with the photo and licence number', camera: 'environment', guide: 'card' },
  { kind: 'dl_back', label: 'Driving licence (back)', hint: 'Vehicle classes (LMV / transport) and validity', camera: 'environment', guide: 'card' },
  { kind: 'id_front', label: 'ID card (front)', hint: 'Aadhaar, passport or voter ID', camera: 'environment', guide: 'card' },
  { kind: 'id_back', label: 'ID card (back)', hint: 'Back side', camera: 'environment', guide: 'card' },
  { kind: 'police_verification', label: 'Police verification', hint: 'Police clearance certificate', camera: 'environment' },
];
