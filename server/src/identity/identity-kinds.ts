/** Positions of identity documents, per kind of person. */
export type OwnerType = 'customer' | 'driver';

export const KIND_LABELS: Record<string, string> = {
  photo: 'Customer photo',
  selfie: 'Selfie',
  id_front: 'ID card (front)',
  id_back: 'ID card (back)',
  dl_front: 'Driving licence (front)',
  dl_back: 'Driving licence (back)',
  address_proof: 'Address proof',
  police_verification: 'Police verification',
};

export const OWNER_KINDS: Record<OwnerType, string[]> = {
  customer: ['photo', 'selfie', 'id_front', 'id_back', 'dl_front', 'dl_back', 'address_proof'],
  driver: ['photo', 'dl_front', 'dl_back', 'id_front', 'id_back', 'police_verification'],
};

/** Customers uploading through their own link: everything except the photo staff take at the counter. */
export const CUSTOMER_LINK_KINDS = ['selfie', 'id_front', 'id_back', 'dl_front', 'dl_back', 'address_proof'];

/** Face pictures must be photos; papers may also be PDFs. */
export const IMAGE_ONLY = new Set(['photo', 'selfie']);

/** Pictures of a face that can be compared with the ID card photo. */
export const FACE_KINDS = ['photo', 'selfie'];

export const kindLabel = (ownerType: string, kind: string) => (kind === 'photo' && ownerType === 'driver' ? 'Driver photo' : (KIND_LABELS[kind] ?? kind));

export const isOwnerType = (v: string): v is OwnerType => v === 'customer' || v === 'driver';
