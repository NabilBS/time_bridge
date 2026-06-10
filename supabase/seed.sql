-- Entwicklungs-Seed: fiktive, klar als Platzhalter benannte Partner-Orte.
-- Echte Orte pflegt das Team über den Web-Admin (Auftrag 003).
insert into public.partner_locations (name, kind, street, postal_code, district, lat, lng, contact, is_verified)
values
  ('MGH Musterstraße [Platzhalter]', 'mehrgenerationenhaus', 'Musterstraße 1', '10115', 'Mitte', 52.5300, 13.3900, 'mgh-mitte@example.org', true),
  ('Stadtteilzentrum Beispielplatz [Platzhalter]', 'stadtteilzentrum', 'Beispielplatz 4', '12043', 'Neukölln', 52.4810, 13.4350, 'stz-neukoelln@example.org', true),
  ('Familienzentrum Platzhalterweg [Platzhalter]', 'familienzentrum', 'Platzhalterweg 7', '13187', 'Pankow', 52.5680, 13.4150, 'fz-pankow@example.org', true),
  ('Stadtbibliothek Demoallee [Platzhalter]', 'bibliothek', 'Demoallee 22', '10243', 'Friedrichshain-Kreuzberg', 52.5120, 13.4540, 'bib-fhain@example.org', true),
  ('Nachbarschaftstreff Probegasse [Platzhalter]', 'nachbarschaftstreff', 'Probegasse 9', '10709', 'Charlottenburg-Wilmersdorf', 52.4900, 13.3180, 'treff-cw@example.org', true);
