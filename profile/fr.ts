import type { Profile } from "../src/profile/schema";
import { albumsFor, CV, profile, type PostcardText } from "./en";
import { seal } from "./seal";

/* Zijiang (Alexis) Yang — édition française du folio. Mêmes objets que en.ts, textes repris de alexisyang.com/?lang=fr. */

const placeNotes = [
  "Là où j’ai grandi, et où les concours scientifiques ont commencé.",
  "Renmin University of China, 2019–2023 : licence en économie, finance, diplômé avec distinction.",
  "KEDGE Business School : bachelor en gestion de la chaîne logistique, double diplôme.",
  "ESSEC Business School : Master in Management, Chaire Immobilier et Développement Durable.",
  "AEW Recherche & Stratégie en 2026, Group Legal de BNP Paribas en 2024, le projet Adagio en 2025.",
  "GWU School of Business : échange de deuxième cycle, d’août 2025 à janvier 2026.",
  "Japon, octobre 2026 : la première étape.",
  "Japon, octobre 2026.",
  "Japon, octobre 2026 : de l’autre côté de la mer intérieure de Seto.",
  "Japon, octobre 2026 : une île de la mer intérieure.",
  "Japon, octobre 2026.",
  "Japon, octobre 2026.",
  "Japon, octobre 2026 : le littoral.",
  "Japon, octobre 2026.",
  "Japon, octobre 2026 : la dernière étape avant Paris, le 17 octobre.",
  "À partir de janvier 2027 : le stage de fin d’études. La ville reste à écrire.",
];

const postcardsFr: PostcardText[] = [
  { label: "Bâtiment Xiuyuan", place: "Renmin University of China", placeLocal: "修远楼", message: "Stylo sur papier. Pas un dessin d’architecte : j’aimais simplement regarder un lieu d’assez près pour le mettre sur papier." },
  { label: "Bâtiment Kaitai", place: "Renmin University of China", placeLocal: "开太楼", message: "Deux semaines plus tard. Avec un père architecte, j’ai appris à remarquer les proportions, les détails et l’usage qu’on fait d’un bâtiment." },
  { label: "AEW", place: "AEW, Paris", message: "Six mois avec l’équipe Recherche & Stratégie européenne : scoring des villes, rapports trimestriels et les graphiques des perspectives bureaux de juillet 2026." },
  { label: "Pro Bono", place: "BNP Paribas, Paris", message: "Group LEGAL Pro Bono : la relance du programme en EMEA, avec le suivi sur Excel, les synthèses pour les sponsors et le site SharePoint." },
  { label: "Chœur", place: "Renmin University of China", placeLocal: "一二·九合唱音乐节", message: "Le 33e festival choral du 9 décembre. Au piano et parmi les voix intermédiaires." },
  { label: "Répétition", place: "Avant le concert", message: "Écouter tout le chœur tout en tenant ma propre ligne." },
  { label: "Laboratoire", place: "Shanghai", message: "Des après-midi au laboratoire : décomposer le problème, tester les hypothèses, apprendre de ce qui n’a pas marché." },
  { label: "Premier prix", place: "Shanghai", placeLocal: "白猫杯", message: "Premier prix, concours de chimie appliquée de Shanghai 2018, catégorie lycée." },
  { label: "Débat", place: "Shanghai", message: "Premier orateur d’un débat en anglais : poser la thèse, construire l’argument, puis écouter la réponse." },
  { label: "Cuisine", place: "Paris", message: "Cuisiner est l’un des moyens les plus simples de rester lié à chez moi. Vivre à l’étranger en a fait une façon de partager d’où je viens." },
  { label: "Shengjian", place: "Shanghai, où que je sois", placeLocal: "生煎", message: "Des raviolis grillés, parfois une fournée à la fois. Shanghai, où que je sois." },
  { label: "Plongée", place: "Sous l’eau", message: "Sous l’eau, la panique complique tout. Respirer calmement, comprendre ce qui se passe, puis agir avec méthode." },
];

const [card, resume, ticket, polaroid, note] = profile.items;

export const profileFr: Profile = {
  lang: "fr",
  name: "Zijiang (Alexis) Yang",
  nameLocal: "杨子江",
  role: "Recherche & stratégie immobilière",
  location: "Paris",
  timezone: "Europe/Paris",
  bio: "Recherche immobilière chez AEW, Master in Management à l’ESSEC. Stage de fin d’études dès janvier 2027.",
  coverTitle: "Alexis Yang — Folio",
  seal,
  source: profile.source,
  links: [
    { label: "E-mail", href: "mailto:zijiang.yang1@essec.edu" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/yangzijiang" },
    { label: "Site", href: "https://alexisyang.com" },
  ],
  items: [
    {
      ...card!,
      kind: "card",
      label: "Carte de visite",
      anecdote: "Recherche immobilière, stratégie et développement international, entre la France, la Chine et les États-Unis.",
      story: "La version courte de tout ce que contient cette pochette. L’intérieur est pour celles et ceux qui répondent.",
      specs: [
        { k: "Basé à", v: "Paris" },
        { k: "Langues", v: "Mandarin · anglais · français" },
      ],
      front: { name: "Zijiang (Alexis) Yang", role: "Recherche & stratégie immobilière", tagline: "De la recherche à l’analyse, de l’analyse à la stratégie" },
      inside: [
        { k: "E-mail", v: "zijiang.yang1@essec.edu" },
        { k: "Site", v: "alexisyang.com" },
        { k: "LinkedIn", v: "in/yangzijiang" },
      ],
      insideNote: "Disponible pour un stage de fin d’études à partir de janvier 2027.",
    },
    {
      ...resume!,
      kind: "resume",
      label: "CV",
      anecdote: "La recherche immobilière chez AEW, un projet de stratégie pour le directeur général d’Adagio, la conduite de projets chez BNP Paribas.",
      story: "Des données sources à une recommandation claire : la même méthode chez AEW, sur le projet Adagio et dans le programme Pro Bono.",
      specs: [
        { k: "Mis à jour", v: "octobre 2026" },
        { k: "Aussi en", v: "English · 中文" },
      ],
      summary: "Étudiant en Master in Management à l’ESSEC : analyse quantitative, stratégie, expérience interculturelle. Stage de fin d’études recherché à partir de janvier 2027.",
      experience: [
        {
          org: "AEW (Natixis Investment Managers)",
          role: "Stagiaire Analyste Recherche & Stratégie",
          from: "févr. 2026",
          to: "août 2026",
          bullets: [
            "Automatisation du scoring multicritère bureaux et logistique : de 45 à 72 villes, publication tous les trois mois au lieu de six.",
            "Données, régressions et graphiques des perspectives européennes des bureaux, juillet 2026.",
            "Études de positionnement d’actifs : acquisitions, cessions, financement.",
          ],
        },
        {
          org: "Adagio × ESSEC",
          role: "Stratégie de développement immobilier, codirection",
          from: "janv. 2025",
          to: "juil. 2025",
          bullets: ["Scoring de 35+ villes pour trois marques ; recommandations au directeur général. Note : 19/20."],
        },
        {
          org: "BNP Paribas, Group Legal Pro Bono",
          role: "Assistant juridique (stage)",
          from: "févr. 2024",
          to: "août 2024",
          bullets: ["Relance du programme Pro Bono EMEA : suivi, présentations, SharePoint."],
        },
      ],
      education: [
        { school: "ESSEC Business School", degree: "Master in Management, Chaire Immobilier", from: "2023", to: "2027" },
        { school: "George Washington University", degree: "Échange de deuxième cycle", from: "2025", to: "2026" },
        { school: "Renmin University of China", degree: "Licence en économie (finance), mention", from: "2019", to: "2023" },
        { school: "KEDGE Business School", degree: "Bachelor, gestion de la chaîne logistique", from: "2019", to: "2023" },
      ],
      skills: ["Études de marché", "Régressions", "Scoring multicritère", "Visualisation de données", "Excel · Power BI"],
      languages: ["Mandarin (langue maternelle)", "Anglais (IELTS 7,5)", "Français (TCF B2)"],
      pdf: `${CV}Zijiang_Yang_CV_FR.421120a8865312b7.pdf`,
    },
    {
      ...ticket!,
      kind: "ticket",
      label: "Laissez-passer",
      anecdote: "Plus de 35 villes européennes, trois marques, des recommandations pour le directeur général. Note : 19/20.",
      story: "Un projet de stratégie ESSEC pour Adagio : étude du marché des séjours prolongés, indicateurs de demande, scoring multicritère et benchmark concurrentiel, jusqu’à une priorisation des villes et des modèles d’exploitation pour Access, Original et Premium.",
      event: "Adagio × ESSEC",
      date: "2025",
      city: "Paris",
      seat: "Codirection",
      talk: "Où Adagio doit-il se développer ?",
      serial: "19/20",
      specs: [
        { k: "Villes", v: "35+" },
        { k: "Marques", v: "Access · Original · Premium" },
      ],
      links: [{ label: "Le projet sur alexisyang.com", href: "https://alexisyang.com/?lang=fr#adagio-strategy" }],
    },
    {
      ...polaroid!,
      kind: "polaroid",
      label: "Polaroid",
      anecdote: "Un semestre de l’autre côté de l’Atlantique : échange à la GWU School of Business.",
      story: "Des cours de niveau MBA en droit des affaires américain (contrats, propriété, responsabilité civile), en analyse quantitative de l’investissement immobilier, et en analyse de données avec Power BI.",
      caption: "washington, d.c.",
      image: "photos/washington.jpg",
      tint: "#c9d3da",
      place: "Washington, D.C.",
      date: "automne 2025",
      back: "Échange à GWU, d’août 2025 à janvier 2026, dans le cadre de l’ESSEC.",
    },
    {
      ...note!,
      kind: "note",
      label: "Un mot",
      anecdote: "Un 一筆箋 est une feuille étroite pour quelques lignes : trop court pour une lettre, plus attentionné qu’un message.",
      text: "Merci de l’avoir ouvert. Je recherche un stage de fin d’études à partir de janvier 2027 en investissement immobilier, gestion d’actifs, recherche ou stratégie. Si quelque chose ici a retenu votre attention, écrivez-moi.",
      from: "Alexis",
      date: "2026-10-24",
    },
  ],
  albums: albumsFor(placeNotes, postcardsFr, "Alexis"),
};
