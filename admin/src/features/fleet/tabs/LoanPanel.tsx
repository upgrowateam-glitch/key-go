import React from 'react';
import { Text, View } from 'react-native';
import { IndianRupee, Landmark } from 'lucide-react-native';
import { Card, EmptyState, Grid, KeyValueGrid, ProgressBar, StatTile } from '../../../components/kit';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../../lib/format';
import { useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';

export function LoanPanel({ v }: { v: Vehicle }) {
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const loan = v.loanDetails;
  if (!loan) {
    return (
      <Card>
        <EmptyState title="No loan on this vehicle" message="This vehicle is recorded as owned outright. Add loan details when a vehicle is financed." icon={(c) => <Landmark size={22} color={c} />} />
      </Card>
    );
  }
  const remaining = Math.max(0, loan.tenureMonths - loan.paidMonths);
  const outstanding = remaining * loan.emiAmount;
  const progress = loan.tenureMonths ? loan.paidMonths / loan.tenureMonths : 0;
  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label="Monthly EMI" value={formatINR(loan.emiAmount)} tone="primary" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="EMIs paid" value={`${loan.paidMonths} / ${loan.tenureMonths}`} tone="success" hint={`${Math.round(progress * 100)}% of tenure`} />
        <StatTile label="EMIs remaining" value={remaining} tone="info" hint={`${remaining} months left`} />
        <StatTile label="Outstanding (estimate)" value={formatINRCompact(outstanding)} tone="warning" hint="Remaining EMIs × EMI" />
      </Grid>
      <Card>
        <Text style={styles.cardTitle}>Loan details</Text>
        <KeyValueGrid
          items={[
            { label: 'Bank / lender', value: loan.bankName },
            { label: 'Loan account', value: loan.accountNo },
            { label: 'EMI amount', value: formatINR(loan.emiAmount) },
            { label: 'Tenure', value: `${loan.tenureMonths} months` },
            { label: 'Paid months', value: String(loan.paidMonths) },
            { label: 'Outstanding (estimate)', value: formatINR(outstanding) },
          ]}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.kLabel}>Repayment progress</Text>
          <Text style={styles.kValueSm}>{Math.round(progress * 100)}%</Text>
        </View>
        <ProgressBar value={progress} />
        <Text style={[styles.hint, { marginTop: 10 }]}>
          Outstanding is an estimate: (tenure − paid months) × EMI. It ignores interest/principal split, prepayments and foreclosure charges —
          the lender statement is the source of truth.
        </Text>
      </Card>
    </View>
  );
}
