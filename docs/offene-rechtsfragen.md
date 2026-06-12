# Offene Rechtsfragen

Diese Punkte sind **vor Public Launch** anwaltlich zu klären. Der Pilotprozess ist auf Datenminimierung ausgelegt, ersetzt die Prüfung aber nicht.

## Erweitertes Führungszeugnis (BZRG / DSGVO)

- **Einsichtnahme vs. Speicherung:** Nach § 30a BZRG ist für ehrenamtliche Tätigkeiten mit Kindern üblicherweise die *Einsichtnahme* vorgesehen, nicht die Speicherung einer Kopie. Unser Pilotprozess lädt das Dokument zur Prüfung hoch und **löscht die Datei nach der Prüfung**; gespeichert bleiben nur Status (`approved`) und `valid_until` (Ausstellungsdatum + 3 Jahre). Ob dieser Upload-Prüf-Lösch-Prozess BZRG-konform ist oder durch reine Vor-Ort-/Video-Einsichtnahme ersetzt werden muss, ist anwaltlich zu bestätigen.
- **Rechtsgrundlage (DSGVO):** Verarbeitung besonders sensibler Daten (Art. 9/10 DSGVO bzw. § 42 BDSG-Anschlussfragen bei Strafregisterdaten) – Rechtsgrundlage, Einwilligungstext und Informationspflichten (Art. 13) sind zu prüfen.
- **Löschkonzept:** Maximale Aufbewahrungsdauer der Datei bis zur Prüfung, Umgang mit abgelehnten Einreichungen und verwaisten Uploads, Protokollierungsumfang.
- **Wiedervorlage:** 3-Jahres-Frist für `valid_until` ist eine Konvention des Piloten, keine gesetzliche Vorgabe – Frist anwaltlich validieren.

## Status

- [ ] Kanzlei beauftragt
- [ ] Prozess freigegeben oder Anpassung definiert

## Meldungen nach Konto-Löschung (Auftrag 007)

Ob Missbrauchsmeldungen nach einer Konto-Löschung (anonymisiert) aufbewahrt werden dürfen oder müssen, ist anwaltlich zu klären. **Bis dahin gilt vollständige Löschung:** `reports.reporter_profile` und `reports.reported_profile` kaskadieren – mit dem Konto verschwinden auch die Meldungen.

- [ ] Aufbewahrungspflicht/-erlaubnis geklärt; ggf. Anonymisierungs-Migration als Folgeauftrag

## Befragungsdaten (Auftrag 008)

Die freiwillige In-App-Kurzbefragung (NPS, Einsamkeits-/Entlastungswert, optionaler Freitext) ist in die **Datenschutzerklärung aufzunehmen** (Zweck: Wirkungsmessung/Förder-Reporting; Auswertung nur aggregiert, Zellen < 5 werden unterdrückt; Antworten löschen sich mit dem Konto).

- [ ] Datenschutzerklärung ergänzt

## DSFA vor Public Launch (Auftrag 007)

Datenschutz-Folgenabschätzung (Art. 35 DSGVO) ist vor dem öffentlichen Launch zu erstellen – besonders sensible Verarbeitung (Strafregisterdaten, Kontakt zwischen Senioren und Familien mit Kindern).

- [ ] DSFA beauftragt und abgeschlossen

## Video-Ident: Eskalationsabruf & Aufbewahrung (Auftrag 010)

Die Identitätsdaten (Ausweis, Selfie) liegen ausschließlich beim Ident-Anbieter (AVV); Zeitbrücke speichert nur das Ergebnis. Anwaltlich zu klären: **Rechtsgrundlage eines Eskalationsabrufs** (in welchen Fällen darf das Team Identitätsdaten beim Anbieter einsehen, definierter Prozess) und **Aufbewahrungsfristen beim Anbieter**. Vertrag + AVV vor Anbindung des echten Anbieters.

- [ ] Eskalationsprozess definiert und geprüft
- [ ] AVV mit gewähltem Anbieter geschlossen
