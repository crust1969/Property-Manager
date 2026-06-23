/** Mieteingänge breakdown: offen vs bezahlt */
export interface Mieteingaenge {
  offen_anzahl: number;
  offen_summe: number;
  bezahlt_anzahl: number;
  bezahlt_summe: number;
}

/** Handlungsbedarf section: action items requiring attention */
export interface Handlungsbedarf {
  offene_erinnerungen: number;
  fehlende_belege: number;
  ungeklaerte_buchungen: number;
}

/** Dashboard KPIs response from GET /api/v1/dashboard */
export interface DashboardKPIs {
  mieteingaenge: Mieteingaenge;
  einnahmen_ytd: number;
  ausgaben_ytd: number;
  werbungskosten_ytd: number;
  afa_ytd: number;
  zinsen_ytd: number;
  cashflow_ytd: number;
  handlungsbedarf: Handlungsbedarf;
}
