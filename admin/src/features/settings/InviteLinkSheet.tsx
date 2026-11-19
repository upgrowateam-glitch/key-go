import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Copy, Mail, MessageCircle } from 'lucide-react-native';
import { Button, Field, FormSheet } from '../../components/kit';
import type { StaffRole } from '../../services/auth';
import { useThemeColors } from '../../theme';

/** Shows a new invitation link with ways to send it. The link is shown only now; a new one can be made later. */
export function InviteLinkSheet({ name, email, role, link, onClose }: { name: string; email: string; role: StaffRole; link: string; onClose: () => void }) {
  const colors = useThemeColors();
  const [copied, setCopied] = useState(false);
  const first = name.split(' ')[0];
  const message = `Hi ${first}, you've been added to KeyGo Admin as ${role}. Open this link to set your password and sign in (it works once, for 7 days): ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <FormSheet visible title={`Invitation for ${name}`} onClose={onClose} footer={<Button label="Done" onPress={onClose} />}>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
        Send this link to {first}. They open it, choose their own password and are signed in. It works once and expires in 7 days. Anyone with the link can use it, so send it only to them.
      </Text>
      <Field label="Invitation link" value={link} editable={false} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button label={copied ? 'Copied' : 'Copy link'} icon={(c) => <Copy size={15} color={c} />} onPress={copy} />
        <Button label="Share on WhatsApp" variant="outline" icon={(c) => <MessageCircle size={15} color={c} />} onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)} />
        <Button
          label="Send by email"
          variant="outline"
          icon={(c) => <Mail size={15} color={c} />}
          onPress={() => Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('Your KeyGo Admin account')}&body=${encodeURIComponent(message)}`)}
        />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>Lost the link? Use “Invite link” on their row to make a new one; the old link then stops working.</Text>
    </FormSheet>
  );
}
