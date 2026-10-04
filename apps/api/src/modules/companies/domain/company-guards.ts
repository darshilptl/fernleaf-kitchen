/**
 * Company guards. PDF §4.4.
 *
 * Exactly one active default address per company (partial unique
 * index at the DB layer; this resolves intent): a single address
 * is always the default; with several, exactly one must be marked.
 */
export interface AddressIntent {
  isDefault?: boolean;
}

export function resolveDefaultAddresses<T extends AddressIntent>(addresses: T[]): T[] {
  if (addresses.length === 1) {
    const only = addresses[0];
    if (only === undefined) {
      return addresses;
    }
    return [{ ...only, isDefault: true }];
  }
  const marked = addresses.filter((address) => address.isDefault === true);
  if (marked.length !== 1) {
    throw new Error('COMPANY_DEFAULT_ADDRESS');
  }
  return addresses.map((address) => ({ ...address, isDefault: address.isDefault === true }));
}
