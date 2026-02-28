import prisma from '../db/prisma';
import { ContactResponse } from '../types';

export async function identifyContact(
  email: string | null,
  phoneNumber: string | null
): Promise<ContactResponse> {
  // ─────────────────────────────────────────────
  // STEP 1: Find all contacts that match email OR phone
  // ─────────────────────────────────────────────
  const matchConditions: Array<{ email: string } | { phoneNumber: string }> = [];
  if (email) matchConditions.push({ email });
  if (phoneNumber) matchConditions.push({ phoneNumber });

  const matchedContacts = await prisma.contact.findMany({
    where: {
      OR: matchConditions,
      deletedAt: null,
    },
  });

  // ─────────────────────────────────────────────
  // STEP 2: No matches → create brand new primary
  // ─────────────────────────────────────────────
  if (matchedContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'primary',
        linkedId: null,
      },
    });

    return buildResponse(newContact.id, [], newContact.email, newContact.phoneNumber);
  }

  // ─────────────────────────────────────────────
  // STEP 3: Resolve all matched contacts → find root primaries
  // ─────────────────────────────────────────────
  // Collect all primary IDs (either the contact itself is primary, or follow linkedId)
  const primaryIds = new Set<number>();

  for (const contact of matchedContacts) {
    if (contact.linkPrecedence === 'primary') {
      primaryIds.add(contact.id);
    } else if (contact.linkedId !== null) {
      primaryIds.add(contact.linkedId);
    }
  }

  // Fetch all actual primary contacts (some might not have been in the initial match)
  const allPrimaries = await prisma.contact.findMany({
    where: {
      id: { in: Array.from(primaryIds) },
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' }, // oldest first
  });

  // ─────────────────────────────────────────────
  // STEP 4: If there are multiple primaries → demote newer ones
  // ─────────────────────────────────────────────
  let truePrimary = allPrimaries[0]; // oldest = true primary

  if (allPrimaries.length > 1) {
    const newPrimaries = allPrimaries.slice(1); // all newer primaries to demote

    for (const demoted of newPrimaries) {
      // Demote this primary → secondary
      await prisma.contact.update({
        where: { id: demoted.id },
        data: {
          linkPrecedence: 'secondary',
          linkedId: truePrimary.id,
        },
      });

      // Re-link all of demoted primary's children → true primary
      await prisma.contact.updateMany({
        where: {
          linkedId: demoted.id,
          deletedAt: null,
        },
        data: {
          linkedId: truePrimary.id,
        },
      });
    }
  }

  // ─────────────────────────────────────────────
  // STEP 5: Fetch the full group (primary + all secondaries)
  // ─────────────────────────────────────────────
  const allGroupContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: truePrimary.id }, { linkedId: truePrimary.id }],
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  // ─────────────────────────────────────────────
  // STEP 6: Check if incoming request has NEW info not in this group
  // ─────────────────────────────────────────────
  const existingEmails = new Set(allGroupContacts.map((c) => c.email).filter((x: string | null): x is string => x !== null));
  const existingPhones = new Set(allGroupContacts.map((c) => c.phoneNumber).filter((x: string | null): x is string => x !== null));

  const isNewEmail = email && !existingEmails.has(email);
  const isNewPhone = phoneNumber && !existingPhones.has(phoneNumber);

  // Only create a new secondary if there is at least one new piece of information
  if (isNewEmail || isNewPhone) {
    const newSecondary = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'secondary',
        linkedId: truePrimary.id,
      },
    });
    allGroupContacts.push(newSecondary);
  }

  // ─────────────────────────────────────────────
  // STEP 7: Build + return consolidated response
  // ─────────────────────────────────────────────
  const primaryContact = allGroupContacts.find((c) => c.id === truePrimary.id)!;
  const secondaries = allGroupContacts.filter((c) => c.id !== truePrimary.id);

  return buildResponse(
    truePrimary.id,
    secondaries,
    primaryContact.email,
    primaryContact.phoneNumber
  );
}

// ─────────────────────────────────────────────
// Helper: Build the response object
// ─────────────────────────────────────────────
function buildResponse(
  primaryId: number,
  secondaries: Array<{ id: number; email: string | null; phoneNumber: string | null }>,
  primaryEmail: string | null,
  primaryPhone: string | null
): ContactResponse {
  // Deduplicated emails: primary's email first, then secondaries (no nulls)
  const emails = Array.from(
    new Set([
      ...(primaryEmail ? [primaryEmail] : []),
      ...secondaries.map((c) => c.email).filter((e): e is string => e !== null),
    ])
  );

  // Deduplicated phones: primary's phone first, then secondaries (no nulls)
  const phoneNumbers = Array.from(
    new Set([
      ...(primaryPhone ? [primaryPhone] : []),
      ...secondaries.map((c) => c.phoneNumber).filter((p): p is string => p !== null),
    ])
  );

  return {
    primaryContatctId: primaryId,
    emails,
    phoneNumbers,
    secondaryContactIds: secondaries.map((c) => c.id),
  };
}
