/**
 * Utility for sending automated WhatsApp notifications.
 * This can be connected to a provider like Fonnte, Twilio, or Meta API.
 */
export async function sendWhatsAppNotification(phone: string | null, message: string) {
  if (!phone) {
    console.log('WhatsApp notification skipped: No phone number provided.');
    return;
  }

  // Clean the phone number (remove +, spaces, etc. and ensure it starts with 62)
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.substring(1);
  } else if (!cleanPhone.startsWith('62')) {
    // If it's just a local number starting with 8...
    if (cleanPhone.startsWith('8')) {
      cleanPhone = '62' + cleanPhone;
    }
  }

  console.log(`[WhatsApp Sync] Sending to ${cleanPhone}: ${message}`);

  const token = process.env.WHATSAPP_API_TOKEN;
  if (!token) {
    console.log('WhatsApp notification paused: WHATSAPP_API_TOKEN not found in environment.');
    return { status: 'mock_sent', target: cleanPhone };
  }

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 
        'Authorization': token 
      },
      body: new URLSearchParams({
        target: cleanPhone,
        message: message,
        countryCode: '62' // default for Indonesia
      })
    });
    
    const result = await res.json();
    console.log('[WhatsApp Sync] Fonnte Response:', result);
    return result;
  } catch (error) {
    console.error('WhatsApp Sync Error:', error);
    return { status: 'error', error };
  }
}
