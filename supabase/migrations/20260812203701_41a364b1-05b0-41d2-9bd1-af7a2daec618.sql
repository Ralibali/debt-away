DO $$
DECLARE u uuid := 'f0401f29-f59c-4477-b15f-36beae47f748';
BEGIN
DELETE FROM public.loans WHERE user_id = u;
DELETE FROM public.savings_accounts WHERE user_id = u;
DELETE FROM public.intentions WHERE user_id = u;

INSERT INTO public.loans (user_id, name, kind, has_collateral, is_revolving, current_balance, credit_limit, nominal_rate, min_payment, min_payment_pct, monthly_fee, payment_day, interest_daily, notes) VALUES
(u,'Brocc','privatlan',false,false,325773.40,null,13.73,4470.00,null,0,null,false,'Startbelopp 373 000 kr. Effektiv 15,03 %. 158 mån kvar av 163. Ingen försäkring. Ränta gäller fr.o.m. 2026-04-21. Tryck ALDRIG på "Sänk din månadskostnad" — den förlänger löptiden.'),
(u,'Nordax 100100196602','privatlan',false,false,54045.28,null,18.99,2469.01,null,0,26,false,'FÖRSÄKRING = JA, premien okänd — begär siffran och räkna om. Betalningen höjdes från 2 254,80 till 2 469,01 i maj 2026, orsak obekräftad. 31 mån kvar. Autogiro.'),
(u,'Northmill kontokredit','kontokredit',false,true,46138.00,50000.00,16.30,1608.00,null,330,null,false,'OSÄKER ränta: härledd ur räntepost 622,65 kr (2026-07-31). IncomeProtectionFee 330 kr/mån = 8,6 procentenheter extra -> 24,9 % effektivt, dyrast av alla. SÄG UPP AVGIFTEN. Höj INTE gränsen till 75 000.'),
(u,'BN 10697772002','privatlan',false,false,15397.26,null,19.99,920.00,null,35,28,false,'STATUS FÖRFALLIT per 2026-07-28. Effektiv 22,63 %. OSÄKER: minimibetalning uppskattad. Autogiro har troligen inte gått igenom.'),
(u,'Collector 3850290507','privatlan',false,false,14036.59,null,17.65,991.00,null,35,null,false,'Ursprung 25 000 kr. Effektiv 20,38 %. 16 mån kvar. Låneskydd: nej.'),
(u,'BN 10697772004','privatlan',false,false,13972.34,null,18.99,833.56,null,35,28,false,'Effektiv 20,56 %. Faktura 2026-07-28 betald. Saldo bekräftat: 14 805,90 − 833,56 = 13 972,34.'),
(u,'Collector 3863741801','privatlan',false,false,13090.98,null,16.20,824.00,null,30,null,false,'Ursprung 22 000 kr. Effektiv 18,85 %. 18 mån kvar. Lägst ränta av de sju små.'),
(u,'BN 10697772005','privatlan',false,false,10000.00,null,17.49,600.00,null,35,28,false,'Nytt lån. Effektiv 18,83 %. OSÄKER: minimibetalning uppskattad.'),
(u,'Brixo kontokredit','kontokredit',false,true,8527.32,null,22.70,400.00,4.00,0,26,false,'Konto 401-255823-6130. OSÄKER ränta: härledd ur post 162,20 kr (2026-07-31). Minimi = 4 % av utgående saldo, lägst 400 kr. Dröjsmålsränta 23 %. Av 400 kr är 161 kr ränta.'),
(u,'BN 10697772003','privatlan',false,false,8160.75,null,18.50,354.16,null,35,28,false,'OSÄKER: saldo härlett (8 514,91 − 354,16), ränta ANTAGEN till 18,50 % — bekräfta båda i appen.');

INSERT INTO public.savings_accounts (user_id, name, provider, kind, current_value, target_value, is_buffer) VALUES
(u,'Avanza','Avanza','isk',35000.00,null,false),
(u,'Buffert',null,'buffert',0.00,30000.00,true),
(u,'Bostadsförsäljning',null,'sparkonto',0.00,null,false);

INSERT INTO public.user_parameters (user_id, isk_fribelopp, isk_schablonranta, kapitalskatt, ranteavdrag_sakerhet, ranteavdrag_utan_sakerhet, expected_return, cooldown_small_limit, cooldown_large_limit)
VALUES (u,300000,0.0355,0.30,0.30,0.00,0.07,500,2000)
ON CONFLICT (user_id) DO UPDATE SET isk_fribelopp=excluded.isk_fribelopp, isk_schablonranta=excluded.isk_schablonranta, kapitalskatt=excluded.kapitalskatt, ranteavdrag_sakerhet=excluded.ranteavdrag_sakerhet, ranteavdrag_utan_sakerhet=excluded.ranteavdrag_utan_sakerhet, expected_return=excluded.expected_return, cooldown_small_limit=excluded.cooldown_small_limit, cooldown_large_limit=excluded.cooldown_large_limit;

INSERT INTO public.intentions (user_id, trigger_text, action_text, trigger_type, active) VALUES
(u,'Idag','Säg upp IncomeProtectionFee hos Northmill — 330 kr/mån, 3 960 kr/år','date',true),
(u,'Idag','Betala förfallen faktura BN 10697772002 och kontrollera autogirot','date',true),
(u,'Innan pengarna används','Utred vinstskatten på bostadsförsäljningen — 22 % av vinsten','date',true),
(u,'Denna vecka','Be Nordax om försäkringspremien och orsaken till höjningen i maj','date',true),
(u,'Denna vecka','Bekräfta ränta och saldo på BN 10697772003','date',true),
(u,'När kapitalet finns','Behåll 30 000 kr som buffert på sparkonto','date',true),
(u,'När kapitalet finns','Lös de sju små (83 185 kr) och STÄNG samtliga sju konton','date',true),
(u,'När lönen kommer','Hela överskottet till Nordax, därefter Northmill, därefter Brocc','payday',true);
END $$;