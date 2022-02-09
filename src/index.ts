import { PublicKey, Connection, Commitment } from "@solana/web3.js"

import { createHash } from 'crypto';

export const NAME_PROGRAM_ID = new PublicKey(
  'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX'
);

export const HASH_PREFIX = 'SPL Name Service';

/**
 * get a name hash with 'SPL Name Service'
 * @param name target name
 * @returns 
 */
export function getHashedName(name: string): Buffer {
  const input = HASH_PREFIX + name;
  const buffer = createHash('sha256').update(input, 'utf8').digest();
  return buffer;
}

/**
 * get Name Account Key by hashed name string
 * @param hashed_name hashed name buffer
 * @param nameClass pubkey of class
 * @param nameParent pubkey of parent
 * @returns 
 */
export async function resolveNameAccountKey(
  hashed_name: Buffer,
  nameClass?: PublicKey,
  nameParent?: PublicKey
): Promise<PublicKey> {
  const seeds = [hashed_name];
  if (nameClass) {
    seeds.push(nameClass.toBuffer());
  } else {
    seeds.push(Buffer.alloc(32));
  }
  if (nameParent) {
    seeds.push(nameParent.toBuffer());
  } else {
    seeds.push(Buffer.alloc(32));
  }
  const [nameAccountKey] = await PublicKey.findProgramAddress(
    seeds,
    NAME_PROGRAM_ID
  );
  return nameAccountKey;
}

/**
 * get Name Account Key by name
 * @param name 
 * @returns 
 */
export function resolveNameAccountKeyByName(name: string, parent?: PublicKey, klass?: PublicKey): Promise<PublicKey> {
  return resolveNameAccountKey(
    getHashedName(name),
    klass,
    parent,
  )
}

/**
 * ## resolve standard ONS name
 * 
 * calculate a name like `a.b.c`, and returns an array of NameKey and Key path,
 * in the same order as `a b c`
 * 
 * @param domain the domain name in hand writting `a.b.c`, lowerCase only
 * @param unknownParent Parent NameKey, in case of some one hide his/her parent name.
 * @returns 
 */
export function resolve_STD_ONS(domain: string, unknownParent?: PublicKey): Promise<PublicKey[]> {

  // TODO: validate the name.
  let names = domain.trim().toLowerCase().split('.')
  // Std ONS do not use class in the path.
  return resolve_UTF8_ONS(names, unknownParent)
}

/**
 * ## get UTF-8 Name Account key
 * 
 * In general, typing utf-8 names is hard, for someting like `锕.苯.com`.
 * 
 * @param path the string array path.
 * @param unknownParent Parent NameKey, in case of some one hide his/her parent name.
 * @returns 
 */
export async function resolve_UTF8_ONS(path: string[], unknownParent?: PublicKey): Promise<PublicKey[]> {

	if (path.length === 0) {
		throw new Error('name path is empty array, can not create get the key path.')
	}

  let keys: PublicKey[] = [];

  for (let i = path.length - 1, parentNameKey = unknownParent; i >= 0; i--) {
    let name = path[i];
    let nameKey: PublicKey = await resolveNameAccountKeyByName(name, parentNameKey);
    keys.unshift(nameKey);
    parentNameKey = nameKey;
  }

  return keys;
}

/**
 * Information describing an account.
 * This type is from `@solana/web3.js`
 */
export type AccountInfo<T> = {
  /** `true` if this account's data contains a loaded program */
  executable: boolean;
  /** Identifier of the program that owns the account */
  owner: PublicKey;
  /** Number of lamports assigned to the account */
  lamports: number;
  /** Optional data assigned to the account */
  data: T;
  /** Optional rent epoch infor for account */
  rentEpoch?: number;
};

/**
 * Parse AccountInfo Data to Name Info
 * @param nameAccount 
 * @returns 
 */
export function parseNameAccountInfo(nameAccount: AccountInfo<Buffer> | null) {
  const KEY_LEN = 32;
  // owner 32 + class 32 + parent 32 = 96
	const HEADER_LEN = 96;

	if (!nameAccount) {
		throw new Error('Unable to find the given account.');
	}

	if (!nameAccount.data || nameAccount.data.length < HEADER_LEN) {
		throw new Error('Invalid name account data')
	}

	let parentNameKey = nameAccount.data.slice(0, KEY_LEN);
	let ownerKey = nameAccount.data.slice(1 * KEY_LEN, 2 * KEY_LEN);
	let classKey = nameAccount.data.slice(2 * KEY_LEN, 3 * KEY_LEN);
	let extra = nameAccount.data.slice(HEADER_LEN)

	return {
		parentName: new PublicKey(parentNameKey),
		owner: new PublicKey(ownerKey),
		class: new PublicKey(classKey),
		data: extra,
		lamports: nameAccount.lamports,
    rentEpoch: nameAccount.rentEpoch,
	}
}

/**
 * Query Name Infomation with web3.js
 * 
 * or you may use this.
 * ```js
 * let accountInfo = await connection.getAccountInfo(pubkey);
 * let nameInfo = parseNameAccountInfo(accountInfo)
 * ```
 * @param connection 
 * @param nameKey 
 * @param commitment
 * @returns 
 */
export function queryNameInfo(connection: Connection, nameKey: PublicKey, commitment?: Commitment) {
	return connection.getAccountInfo(nameKey, commitment)
		.then(accountInfo => parseNameAccountInfo(accountInfo))
}
