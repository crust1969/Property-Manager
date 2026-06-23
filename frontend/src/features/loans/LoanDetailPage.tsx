import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../../i18n/de';
import { Button, Card, Table, type Column } from '../../shared/components';
import { formatCurrency, formatDate, formatPercent } from '../../shared/utils/formatting';
import { fetchLoan, fetchPayments, fetchBalance, fetchSchedule } from './api';
import { PaymentForm } from './PaymentForm';
import { BalanceChart } from './BalanceChart';
import type { Loan, LoanPayment, BalanceEntry, AnnuityScheduleEntry, AnnuityScheduleResult } from './types';

export function LoanDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [balanceEntries, setBalanceEntries] = useState<BalanceEntry[]>([]);
  const [schedule, setSchedule] = useState<AnnuityScheduleResult | null>(null);
  const [scheduleLimit, setScheduleLimit] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  async function loadData(loanId: string) {
    setLoading(true);
    setError(null);
    try {
      const [loanData, paymentsData, balanceData, scheduleData] = await Promise.all([
        fetchLoan(loanId),
        fetchPayments(loanId),
        fetchBalance(loanId),
        fetchSchedule(loanId),
      ]);
      setLoan(loanData);
      setPayments(paymentsData);
      setBalanceEntries(balanceData);
      setSchedule(scheduleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  function handlePaymentSuccess() {
    setShowPaymentForm(false);
    if (id) {
      loadData(id);
    }
  }

  function calculateTotal(payment: LoanPayment): number {
    return payment.interest_amount + payment.repayment_amount + payment.fee_amount + payment.extra_repayment;
  }

  const currentBalance = loan?.remaining_balance ?? (
    balanceEntries.length > 0
      ? balanceEntries[balanceEntries.length - 1].remaining_balance
      : loan?.loan_amount ?? 0
  );

  const paymentColumns: Column<LoanPayment>[] = [
    {
      key: 'payment_date',
      header: 'Datum',
      className: 'w-28',
      render: (p) => formatDate(p.payment_date),
    },
    {
      key: 'interest_amount',
      header: t.darlehen.zinsanteil,
      className: 'w-28 text-right',
      render: (p) => `${formatCurrency(p.interest_amount)} €`,
    },
    {
      key: 'repayment_amount',
      header: 'Tilgung',
      className: 'w-28 text-right',
      render: (p) => `${formatCurrency(p.repayment_amount)} €`,
    },
    {
      key: 'fee_amount',
      header: t.darlehen.gebuehren,
      className: 'w-28 text-right',
      render: (p) => `${formatCurrency(p.fee_amount)} €`,
    },
    {
      key: 'extra_repayment',
      header: t.darlehen.sondertilgung,
      className: 'w-28 text-right',
      render: (p) => `${formatCurrency(p.extra_repayment)} €`,
    },
    {
      key: 'total',
      header: 'Gesamt',
      className: 'w-28 text-right font-medium',
      render: (p) => `${formatCurrency(calculateTotal(p))} €`,
    },
  ];

  const scheduleColumns: Column<AnnuityScheduleEntry>[] = [
    {
      key: 'month',
      header: 'Monat',
      className: 'w-16 text-right',
      render: (entry) => String(entry.month),
    },
    {
      key: 'date',
      header: 'Datum',
      className: 'w-28',
      render: (entry) => formatDate(entry.date),
    },
    {
      key: 'annuity',
      header: 'Annuität',
      className: 'w-28 text-right',
      render: (entry) => `${formatCurrency(entry.annuity)} €`,
    },
    {
      key: 'interestPortion',
      header: 'Zinsanteil',
      className: 'w-28 text-right',
      render: (entry) => `${formatCurrency(entry.interestPortion)} €`,
    },
    {
      key: 'repaymentPortion',
      header: 'Tilgungsanteil',
      className: 'w-28 text-right',
      render: (entry) => `${formatCurrency(entry.repaymentPortion)} €`,
    },
    {
      key: 'remainingBalance',
      header: 'Restschuld',
      className: 'w-32 text-right',
      render: (entry) => `${formatCurrency(entry.remainingBalance)} €`,
    },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t.common.laden}</p>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm" role="alert">
          {error || 'Darlehen nicht gefunden'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/darlehen')}>
            ← {t.common.zurueck}
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {loan.lender} {loan.contract_number ? `(${loan.contract_number})` : ''}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPaymentForm(true)}>
            {t.darlehen.zahlung}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/darlehen/${loan.id}/bearbeiten`)}>
            {t.common.bearbeiten}
          </Button>
        </div>
      </div>

      {/* Stammdaten */}
      <Card title="Stammdaten">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.darlehen.darlehensgeber}</p>
            <p className="text-sm text-gray-900">{loan.lender}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.darlehen.vertragsnummer}</p>
            <p className="text-sm text-gray-900">{loan.contract_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.darlehen.darlehenssumme}</p>
            <p className="text-sm text-gray-900">{formatCurrency(loan.loan_amount)} €</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.darlehen.zinssatz}</p>
            <p className="text-sm text-gray-900">{formatPercent(loan.interest_rate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.darlehen.tilgungssatz}</p>
            <p className="text-sm text-gray-900">{formatPercent(loan.repayment_rate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Sollzinsbindung</p>
            <p className="text-sm text-gray-900">
              {loan.fixed_interest_months ? `${loan.fixed_interest_months} Monate` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tilgungsfreie Monate</p>
            <p className="text-sm text-gray-900">
              {loan.interest_only_months ? `${loan.interest_only_months} Monate` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.darlehen.startdatum}</p>
            <p className="text-sm text-gray-900">{formatDate(loan.start_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.darlehen.enddatum}</p>
            <p className="text-sm text-gray-900">{formatDate(loan.end_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Objekt</p>
            <p className="text-sm text-gray-900">{loan.property_name || '—'}</p>
          </div>
        </div>
      </Card>

      {/* Payment History */}
      <Card title="Zahlungsverlauf">
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={() => setShowPaymentForm(true)}>
            {t.darlehen.zahlung}
          </Button>
        </div>
        {payments.length > 0 ? (
          <Table
            columns={paymentColumns}
            data={payments}
            keyExtractor={(p) => p.id}
          />
        ) : (
          <p className="text-center text-gray-500 py-4">Noch keine Zahlungen erfasst</p>
        )}
      </Card>

      {/* Balance Chart */}
      <BalanceChart entries={balanceEntries} currentBalance={currentBalance} />

      {/* Tilgungsplan (berechnet) */}
      {schedule && (
        <Card title="Tilgungsplan (berechnet)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Monatliche Annuität</p>
              <p className="text-sm text-gray-900 font-medium">{formatCurrency(schedule.monthlyAnnuity)} €</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Gesamtzinsen</p>
              <p className="text-sm text-gray-900 font-medium">{formatCurrency(schedule.totalInterest)} €</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Gesamttilgung</p>
              <p className="text-sm text-gray-900 font-medium">{formatCurrency(schedule.totalRepayment)} €</p>
            </div>
          </div>
          {schedule.schedule.length > 0 ? (
            <>
              <Table
                columns={scheduleColumns}
                data={schedule.schedule.slice(0, scheduleLimit)}
                keyExtractor={(entry) => String(entry.month)}
              />
              {schedule.schedule.length > scheduleLimit && (
                <div className="mt-3 text-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setScheduleLimit((prev) => prev + 60)}
                  >
                    Mehr anzeigen
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-gray-500 py-4">Kein Tilgungsplan verfügbar</p>
          )}
        </Card>
      )}

      {/* Payment Form Modal */}
      <PaymentForm
        loanId={loan.id}
        isOpen={showPaymentForm}
        onClose={() => setShowPaymentForm(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
