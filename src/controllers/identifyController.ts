import { Request, Response } from 'express';
import { identifyContact } from '../services/contactService';

export async function identify(req: Request, res: Response): Promise<void> {
  const { email, phoneNumber } = req.body;

  // Validate: at least one of email or phoneNumber must be provided
  if (!email && !phoneNumber) {
    res.status(400).json({ error: 'At least one of email or phoneNumber is required.' });
    return;
  }

  try {
    const result = await identifyContact(
      email ? String(email) : null,
      phoneNumber ? String(phoneNumber) : null // handle numeric phoneNumber from JSON
    );

    res.status(200).json({ contact: result });
  } catch (error) {
    console.error('Error in /identify:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
