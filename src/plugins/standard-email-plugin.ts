import type {
	EmailContent,
	EmailPlugin,
	GenerationContext,
	PluginCapabilities,
} from "../types.js";

/**
 * Locale-aware greetings for different languages.
 * The placeholder {name} will be replaced with the recipient's first name.
 */
const GREETINGS: Record<string, string[]> = {
	de: [
		"Hallo {name},",
		"Liebe(r) {name},",
		"Guten Tag {name},",
		"Sehr geehrte(r) {name},",
		"{name},",
	],
	fr: [
		"Bonjour {name},",
		"Salut {name},",
		"Cher/Chère {name},",
		"Bonsoir {name},",
		"{name},",
	],
	nl: [
		"Hallo {name},",
		"Beste {name},",
		"Geachte {name},",
		"Dag {name},",
		"{name},",
	],
	es: [
		"Hola {name},",
		"Querido/a {name},",
		"Estimado/a {name},",
		"Buenos días {name},",
		"{name},",
	],
	it: [
		"Ciao {name},",
		"Caro/a {name},",
		"Gentile {name},",
		"Buongiorno {name},",
		"{name},",
	],
	pt: [
		"Olá {name},",
		"Caro/a {name},",
		"Prezado/a {name},",
		"Bom dia {name},",
		"{name},",
	],
	en: ["Hi {name},", "Hey {name},", "Hello {name},", "Dear {name},", "{name},"],
};

/**
 * Locale-aware sign-offs for different languages.
 */
const SIGNOFFS: Record<string, string[]> = {
	de: [
		"Mit freundlichen Grüßen",
		"Viele Grüße",
		"Liebe Grüße",
		"Beste Grüße",
		"Bis bald",
		"Danke",
	],
	fr: [
		"Cordialement",
		"Bien cordialement",
		"Amicalement",
		"À bientôt",
		"Merci",
		"Salutations",
	],
	nl: [
		"Met vriendelijke groet",
		"Groetjes",
		"Hartelijke groet",
		"Tot ziens",
		"Bedankt",
	],
	es: ["Saludos", "Un abrazo", "Atentamente", "Hasta pronto", "Gracias"],
	it: ["Cordiali saluti", "Saluti", "A presto", "Grazie", "Cari saluti"],
	pt: ["Atenciosamente", "Abraços", "Até logo", "Obrigado/a", "Saudações"],
	en: [
		"Best",
		"Thanks",
		"Cheers",
		"Regards",
		"Best regards",
		"Talk soon",
		"Thanks!",
	],
};

/**
 * Locale-aware response starters for replies.
 */
const RESPONSE_STARTERS: Record<string, string[]> = {
	de: [
		"Danke für deine Nachricht.",
		"Guter Punkt.",
		"Ich schaue mir das an.",
		"Klingt gut.",
		"Danke für die Info.",
		"Verstanden, danke.",
		"Das ergibt Sinn.",
		"Danke für das Update.",
	],
	fr: [
		"Merci pour ton message.",
		"Bonne remarque.",
		"Je vais regarder ça.",
		"Ça me semble bien.",
		"Merci de m'avoir prévenu.",
		"Compris, merci.",
		"C'est logique.",
		"Merci pour la mise à jour.",
	],
	nl: [
		"Bedankt voor je bericht.",
		"Goed punt.",
		"Ik zal ernaar kijken.",
		"Klinkt goed.",
		"Bedankt voor de info.",
		"Begrepen, bedankt.",
		"Dat is logisch.",
		"Bedankt voor de update.",
	],
	es: [
		"Gracias por tu mensaje.",
		"Buen punto.",
		"Lo revisaré.",
		"Me parece bien.",
		"Gracias por avisarme.",
		"Entendido, gracias.",
		"Tiene sentido.",
		"Gracias por la actualización.",
	],
	it: [
		"Grazie per il tuo messaggio.",
		"Buon punto.",
		"Ci darò un'occhiata.",
		"Mi sembra bene.",
		"Grazie per l'informazione.",
		"Capito, grazie.",
		"Ha senso.",
		"Grazie per l'aggiornamento.",
	],
	pt: [
		"Obrigado pela mensagem.",
		"Bom ponto.",
		"Vou dar uma olhada.",
		"Parece bom.",
		"Obrigado por avisar.",
		"Entendido, obrigado.",
		"Faz sentido.",
		"Obrigado pela atualização.",
	],
	en: [
		"Thanks for reaching out.",
		"Good point.",
		"I'll look into that.",
		"Sounds good to me.",
		"Thanks for letting me know.",
		"Got it, thanks.",
		"Makes sense.",
		"Thanks for the update.",
	],
};

/**
 * Locale-aware forward introductions.
 */
const FORWARD_INTROS: Record<string, string[]> = {
	de: [
		"Zur Info",
		"Das könnte dich interessieren.",
		"Leite das mal weiter.",
		"Siehe unten.",
		"FYI - siehe unten",
	],
	fr: [
		"Pour info",
		"Ça pourrait t'intéresser.",
		"Je te fais suivre.",
		"Voir ci-dessous.",
		"FYI - voir ci-dessous",
	],
	nl: [
		"Ter info",
		"Dit is misschien interessant voor je.",
		"Stuur ik even door.",
		"Zie hieronder.",
		"FYI - zie hieronder",
	],
	es: [
		"Para tu información",
		"Esto podría interesarte.",
		"Te reenvío esto.",
		"Ver abajo.",
		"FYI - ver abajo",
	],
	it: [
		"Per tua informazione",
		"Potrebbe interessarti.",
		"Ti inoltro questo.",
		"Vedi sotto.",
		"FYI - vedi sotto",
	],
	pt: [
		"Para sua informação",
		"Isso pode te interessar.",
		"Encaminhando isso.",
		"Veja abaixo.",
		"FYI - veja abaixo",
	],
	en: [
		"FYI",
		"Thought you might find this interesting.",
		"Forwarding this along.",
		"See below.",
		"FYI - see below",
		"Passing this along.",
		"Thought you should see this.",
	],
};

/**
 * Locale-aware subject line templates.
 * Placeholders: {noun}, {weekday}, {phrase}, {adjective}
 */
const SUBJECT_TEMPLATES: Record<string, string[]> = {
	de: [
		"Kurze Frage zu {noun}",
		"Nachfrage zu unserem {noun}",
		"{phrase}",
		"Treffen am {weekday}?",
		"Re: {phrase}",
		"{adjective} {noun} Update",
		"Kannst du bei {noun} helfen?",
		"Gedanken zu {noun}?",
	],
	fr: [
		"Petite question sur {noun}",
		"Suite à notre {noun}",
		"{phrase}",
		"Réunion {weekday} ?",
		"Re: {phrase}",
		"Mise à jour {adjective} {noun}",
		"Peux-tu aider avec {noun} ?",
		"Ton avis sur {noun} ?",
	],
	nl: [
		"Korte vraag over {noun}",
		"Opvolging van ons {noun}",
		"{phrase}",
		"Afspraak {weekday}?",
		"Re: {phrase}",
		"{adjective} {noun} update",
		"Kun je helpen met {noun}?",
		"Gedachten over {noun}?",
	],
	es: [
		"Pregunta rápida sobre {noun}",
		"Seguimiento de nuestro {noun}",
		"{phrase}",
		"¿Reunión el {weekday}?",
		"Re: {phrase}",
		"Actualización de {noun} {adjective}",
		"¿Puedes ayudar con {noun}?",
		"¿Qué piensas de {noun}?",
	],
	it: [
		"Domanda veloce su {noun}",
		"Seguito al nostro {noun}",
		"{phrase}",
		"Incontro {weekday}?",
		"Re: {phrase}",
		"Aggiornamento {adjective} {noun}",
		"Puoi aiutare con {noun}?",
		"Cosa ne pensi di {noun}?",
	],
	pt: [
		"Pergunta rápida sobre {noun}",
		"Acompanhamento do nosso {noun}",
		"{phrase}",
		"Reunião {weekday}?",
		"Re: {phrase}",
		"Atualização {adjective} de {noun}",
		"Pode ajudar com {noun}?",
		"O que acha de {noun}?",
	],
	en: [
		"Quick question about {noun}",
		"Following up on our {noun}",
		"{phrase}",
		"Meeting {weekday}?",
		"Re: {phrase}",
		"{adjective} {noun} update",
		"Can you help with {noun}?",
		"Thoughts on {noun}?",
	],
};

/**
 * Locale-aware email body paragraphs.
 * Placeholders: {noun}, {phrase}
 */
const BODY_PARAGRAPHS: Record<string, string[]> = {
	de: [
		"Ich wollte mich wegen {noun} melden, über das wir gesprochen haben. Ich habe weiter darüber nachgedacht und habe ein paar Ideen, die ich gerne mit dir teilen würde.",
		"Ich hoffe, es geht dir gut. Ich wollte mich noch mal zu unserem letzten Gespräch über {phrase} melden.",
		"Ich wollte nur kurz nachfragen, wie es bei dir läuft. Ich weiß, dass du mit {noun} beschäftigt bist.",
		"Mir ist etwas Interessantes aufgefallen, das mich an unser vorheriges Gespräch erinnert hat. Es geht um {phrase}.",
		"Kurzes Update von meiner Seite: {noun} läuft gut. Ich würde gerne deine Meinung dazu hören, wenn du Zeit hast.",
		"Ich habe die {noun} Unterlagen durchgesehen und habe ein paar Fragen. Hättest du diese Woche Zeit für ein Gespräch?",
		"Danke für deine Geduld, während ich das recherchiert habe. Ich denke, ich habe nützliche Informationen zu {noun}.",
	],
	fr: [
		"Je voulais te contacter au sujet de {noun} dont nous avons parlé. J'y ai réfléchi et j'ai quelques idées à partager avec toi.",
		"J'espère que tu vas bien. Je voulais faire suite à notre dernière conversation sur {phrase}.",
		"Je voulais juste prendre des nouvelles. Je sais que tu es occupé avec {noun}.",
		"J'ai trouvé quelque chose d'intéressant qui m'a fait penser à notre discussion précédente. Ça concerne {phrase}.",
		"Petite mise à jour de mon côté : {noun} avance bien. J'aimerais avoir ton avis quand tu auras un moment.",
		"J'ai examiné les documents sur {noun} et j'ai quelques questions. Tu aurais du temps cette semaine pour en discuter ?",
		"Merci de ta patience pendant que je regardais ça. Je pense avoir des informations utiles sur {noun}.",
	],
	nl: [
		"Ik wilde even contact opnemen over {noun} waar we het over hadden. Ik heb er verder over nagedacht en heb wat ideeën die ik graag met je zou delen.",
		"Ik hoop dat het goed met je gaat. Ik wilde even terugkomen op ons laatste gesprek over {phrase}.",
		"Ik wilde even checken hoe het met je gaat. Ik weet dat je druk bent met {noun}.",
		"Ik kwam iets interessants tegen dat me deed denken aan ons vorige gesprek. Het gaat over {phrase}.",
		"Even een update van mijn kant: {noun} gaat goed. Ik hoor graag je mening wanneer je tijd hebt.",
		"Ik heb de {noun} documenten bekeken en heb wat vragen. Heb je deze week tijd om even te praten?",
		"Bedankt voor je geduld terwijl ik dit uitzoek. Ik denk dat ik nuttige informatie heb over {noun}.",
	],
	es: [
		"Quería contactarte sobre {noun} que discutimos. He estado pensando más en ello y tengo algunas ideas que me gustaría compartir contigo.",
		"Espero que estés bien. Quería hacer seguimiento a nuestra última conversación sobre {phrase}.",
		"Solo quería saber cómo van las cosas. Sé que has estado ocupado con {noun}.",
		"Encontré algo interesante que me hizo pensar en nuestra conversación anterior. Se trata de {phrase}.",
		"Una breve actualización de mi parte: {noun} va bien. Me encantaría conocer tu opinión cuando tengas un momento.",
		"He estado revisando los materiales de {noun} y tengo algunas preguntas. ¿Tendrías tiempo para hablar esta semana?",
		"Gracias por tu paciencia mientras investigaba esto. Creo que tengo información útil sobre {noun}.",
	],
	it: [
		"Volevo contattarti riguardo a {noun} di cui abbiamo parlato. Ci ho pensato ancora e ho alcune idee da condividere con te.",
		"Spero che tu stia bene. Volevo fare seguito alla nostra ultima conversazione su {phrase}.",
		"Volevo solo sapere come vanno le cose. So che sei impegnato con {noun}.",
		"Ho trovato qualcosa di interessante che mi ha fatto pensare alla nostra discussione precedente. Riguarda {phrase}.",
		"Un breve aggiornamento da parte mia: {noun} sta andando bene. Mi piacerebbe avere la tua opinione quando hai un momento.",
		"Ho esaminato i materiali su {noun} e ho alcune domande. Avresti tempo per parlarne questa settimana?",
		"Grazie per la pazienza mentre facevo ricerche. Penso di avere informazioni utili su {noun}.",
	],
	pt: [
		"Queria entrar em contato sobre {noun} que discutimos. Estive pensando mais sobre isso e tenho algumas ideias para compartilhar contigo.",
		"Espero que esteja bem. Queria dar continuidade à nossa última conversa sobre {phrase}.",
		"Só queria saber como estão as coisas. Sei que você está ocupado com {noun}.",
		"Encontrei algo interessante que me fez pensar na nossa conversa anterior. É sobre {phrase}.",
		"Uma breve atualização da minha parte: {noun} está indo bem. Adoraria saber sua opinião quando tiver um momento.",
		"Estive revisando os materiais sobre {noun} e tenho algumas perguntas. Teria tempo para conversar esta semana?",
		"Obrigado pela paciência enquanto eu pesquisava isso. Acho que tenho informações úteis sobre {noun}.",
	],
	en: [
		"I wanted to reach out about {noun} we discussed. I've been thinking about it more and have some ideas I'd like to share with you.",
		"Hope you're doing well. I've been meaning to follow up on our last conversation about {phrase}.",
		"Just wanted to check in and see how things are going on your end. I know you've been busy with {noun}.",
		"I came across something interesting that made me think of our previous discussion. It relates to {phrase}.",
		"Quick update on my end: things have been progressing well with {noun}. I'd love to get your thoughts when you have a moment.",
		"I've been reviewing the {noun} materials and have some questions. Would you have time to chat this week?",
		"Thanks for your patience while I looked into this. I think I have some useful information to share about {noun}.",
	],
};

/**
 * Locale-aware follow-up phrases.
 */
const FOLLOW_UPS: Record<string, string[]> = {
	de: [
		"Lass mich wissen, was du denkst, wenn du Zeit hast.",
		"Wäre schön, wenn wir uns bald mal austauschen könnten.",
		"Ich freue mich auf deine Meinung dazu.",
		"Bin gespannt auf deine Gedanken.",
		"Keine Eile, ich wollte dich nur auf dem Laufenden halten.",
	],
	fr: [
		"Dis-moi ce que tu en penses quand tu auras un moment.",
		"Ce serait bien de se retrouver bientôt.",
		"Je serais ravi d'en discuter si ça t'intéresse.",
		"J'attends tes commentaires avec impatience.",
		"Pas urgent, je voulais juste te tenir au courant.",
	],
	nl: [
		"Laat me weten wat je ervan vindt als je tijd hebt.",
		"Het zou fijn zijn om binnenkort bij te praten.",
		"Ik bespreek het graag verder als je geïnteresseerd bent.",
		"Ik ben benieuwd naar je mening.",
		"Geen haast, ik wilde je alleen even op de hoogte houden.",
	],
	es: [
		"Déjame saber qué piensas cuando puedas.",
		"Sería genial ponernos al día pronto.",
		"Encantado de discutirlo más si te interesa.",
		"Espero tus comentarios.",
		"Sin prisa, solo quería mantenerte informado.",
	],
	it: [
		"Fammi sapere cosa ne pensi quando hai tempo.",
		"Sarebbe bello aggiornarci presto.",
		"Sarò felice di discuterne se ti interessa.",
		"Aspetto i tuoi commenti.",
		"Nessuna fretta, volevo solo tenerti aggiornato.",
	],
	pt: [
		"Me diz o que você acha quando puder.",
		"Seria ótimo nos encontrarmos em breve.",
		"Fico feliz em discutir mais se você tiver interesse.",
		"Aguardo seus comentários.",
		"Sem pressa, só queria te manter informado.",
	],
	en: [
		"Let me know what you think when you get a chance.",
		"Would be great to catch up soon.",
		"Happy to discuss further if you're interested.",
		"Looking forward to hearing your thoughts.",
		"No rush on this, just wanted to keep you in the loop.",
	],
};

/**
 * Locale-aware reply body content.
 */
const REPLY_BODIES: Record<string, string[]> = {
	de: [
		"Ich schaue mir das an und melde mich bis heute Abend bei dir. Wenn du früher etwas brauchst, sag einfach Bescheid.",
		"Guter Punkt. Den Blickwinkel hatte ich noch nicht betrachtet. Lass mich darüber nachdenken und wir können das weiter besprechen.",
		"Helfe ich gerne. Ich habe schon ähnliche Situationen erlebt und habe ein paar Ideen, die funktionieren könnten.",
		"Ich schaue in meinen Kalender und schicke dir ein paar Termine, die passen würden. Sollte diese Woche noch klappen.",
		"Klingt gut. Ich spreche mit dem Team und melde mich, sobald ich mehr Infos habe.",
		"Danke für die Klarstellung. Das ergibt jetzt mehr Sinn. Ich gehe nach deinem Vorschlag vor.",
		"Ich stimme deiner Einschätzung zu. Lass uns mit dem Plan weitermachen und schauen, wie es läuft.",
		"Gute Frage. Ich muss da noch etwas recherchieren. Ich melde mich, sobald ich mehr weiß.",
	],
	fr: [
		"Je vais regarder ça et te recontacter avant la fin de la journée. Si tu as besoin de quelque chose plus tôt, fais-moi signe.",
		"Bon point. Je n'avais pas envisagé cet angle. Laisse-moi y réfléchir et on pourra en discuter davantage.",
		"Je suis ravi de t'aider. J'ai déjà géré des situations similaires et j'ai quelques idées qui pourraient marcher.",
		"Je vais vérifier mon agenda et t'envoyer des créneaux qui conviennent. On devrait trouver quelque chose cette semaine.",
		"Ça me va. Je fais le point avec l'équipe et je reviens vers toi une fois que j'aurai plus d'informations.",
		"Merci pour les précisions. C'est plus clair maintenant. Je vais suivre l'approche que tu as suggérée.",
		"Je suis d'accord avec ton analyse. Continuons avec le plan et voyons comment ça se passe.",
		"Bonne question. Je dois creuser un peu de mon côté. Je te tiens au courant dès que j'en sais plus.",
	],
	nl: [
		"Ik kijk ernaar en kom voor het einde van de dag bij je terug. Als je iets sneller nodig hebt, laat het me weten.",
		"Goed punt. Die invalshoek had ik nog niet bekeken. Laat me erover nadenken en we kunnen het verder bespreken.",
		"Ik help graag. Ik heb vergelijkbare situaties meegemaakt en heb wat ideeën die zouden kunnen werken.",
		"Ik check mijn agenda en stuur je een paar tijden die werken. Moet deze week lukken.",
		"Klinkt goed. Ik overleg met het team en kom terug zodra ik meer informatie heb.",
		"Bedankt voor de verduidelijking. Dat is nu duidelijker. Ik ga verder met de aanpak die je voorstelde.",
		"Ik ben het eens met je beoordeling. Laten we doorgaan met het plan en kijken hoe het gaat.",
		"Goede vraag. Ik moet wat uitzoeken aan mijn kant. Ik laat het je weten zodra ik meer weet.",
	],
	es: [
		"Voy a revisar esto y te contacto antes del final del día. Si necesitas algo antes, solo avísame.",
		"Buen punto. No había considerado ese ángulo antes. Déjame pensarlo y podemos discutirlo más.",
		"Encantado de ayudar con esto. He tratado situaciones similares antes y tengo algunas ideas que podrían funcionar.",
		"Revisaré mi calendario y te enviaré algunos horarios que funcionen. Debería poder encontrar algo esta semana.",
		"Me parece bien. Hablaré con el equipo y te aviso cuando tenga más información.",
		"Gracias por aclarar. Ahora tiene más sentido. Procederé con el enfoque que sugeriste.",
		"Estoy de acuerdo con tu evaluación. Sigamos adelante con el plan y veamos cómo va.",
		"Buena pregunta. Necesito investigar un poco de mi parte. Te actualizaré cuando sepa más.",
	],
	it: [
		"Ci darò un'occhiata e ti ricontatto entro fine giornata. Se hai bisogno di qualcosa prima, fammelo sapere.",
		"Buon punto. Non avevo considerato quell'angolazione. Lasciami pensarci e ne discutiamo ulteriormente.",
		"Felice di aiutare. Ho affrontato situazioni simili prima e ho alcune idee che potrebbero funzionare.",
		"Controllo il mio calendario e ti mando alcuni orari che vanno bene. Dovrei riuscire a trovare qualcosa questa settimana.",
		"Mi sembra buono. Ne parlo con il team e ti aggiorno appena ho più informazioni.",
		"Grazie per il chiarimento. Ora ha più senso. Procederò con l'approccio che hai suggerito.",
		"Sono d'accordo con la tua valutazione. Procediamo con il piano e vediamo come va.",
		"Bella domanda. Devo fare qualche ricerca. Ti aggiorno appena ne so di più.",
	],
	pt: [
		"Vou dar uma olhada e te retorno até o final do dia. Se precisar de algo antes, é só avisar.",
		"Bom ponto. Não tinha considerado esse ângulo antes. Deixa eu pensar e podemos discutir mais.",
		"Fico feliz em ajudar com isso. Já lidei com situações semelhantes e tenho algumas ideias que podem funcionar.",
		"Vou verificar minha agenda e te mando alguns horários que funcionam. Deve dar para achar algo esta semana.",
		"Parece bom. Vou falar com a equipe e te aviso assim que tiver mais informações.",
		"Obrigado por esclarecer. Agora faz mais sentido. Vou seguir com a abordagem que você sugeriu.",
		"Concordo com sua avaliação. Vamos seguir com o plano e ver como vai.",
		"Boa pergunta. Preciso pesquisar um pouco do meu lado. Te atualizo quando souber mais.",
	],
	en: [
		"I'll take a look at this and get back to you by end of day. If you need anything sooner, just let me know.",
		"That's a great point. I hadn't considered that angle before. Let me think about it and we can discuss further.",
		"Happy to help with this. I've dealt with similar situations before and have some ideas that might work.",
		"I'll check my calendar and send over some times that work. Should be able to find something this week.",
		"Sounds good to me. I'll follow up with the team and circle back once I have more information.",
		"Thanks for clarifying. That makes more sense now. I'll proceed with the approach you suggested.",
		"I agree with your assessment. Let's move forward with the plan and see how it goes.",
		"Good question. I'll need to do some digging on my end. Will update you once I know more.",
	],
};

/**
 * Get the base locale code from a locale string.
 * @example "de_AT" -> "de", "en_US" -> "en"
 */
function getBaseLocale(locale: string): string {
	const parts = locale.split("_");
	return parts[0] ?? "en";
}

/**
 * Get locale-aware options with fallback to English.
 */
function getLocaleOptions<T>(map: Record<string, T[]>, locale: string): T[] {
	const baseLocale = getBaseLocale(locale);
	return map[baseLocale] ?? map["en"] ?? [];
}

/**
 * Standard email plugin for generating personal/business correspondence.
 * Supports replies, forwards, and original emails with HTML.
 */
export class StandardEmailPlugin implements EmailPlugin {
	readonly id = "standard";
	readonly name = "Standard Email";
	readonly description =
		"Personal and business correspondence with replies and forwards";
	readonly defaultWeight = 1.0;

	readonly capabilities: PluginCapabilities = {
		canBeReply: true,
		canBeForward: true,
		canBeOriginal: true,
		supportsHtml: true,
		supportsAttachments: false,
		supportsMultipleRecipients: true,
	};

	generate(context: GenerationContext): EmailContent {
		const { isReply, isForward, parentMessage } = context;

		if (isReply && parentMessage) {
			return this.generateReply(context);
		}

		if (isForward && parentMessage) {
			return this.generateForward(context);
		}

		return this.generateOriginal(context);
	}

	private generateOriginal(context: GenerationContext): EmailContent {
		const { faker, sender, recipients, requestHtml, locale } = context;

		const primaryRecipient = recipients[0];
		if (!primaryRecipient) {
			throw new Error("No recipients provided");
		}

		const subjectTemplates = getLocaleOptions(SUBJECT_TEMPLATES, locale);
		const subjectTemplate = faker.helpers.arrayElement(subjectTemplates);
		const subject = subjectTemplate
			.replace("{noun}", faker.company.buzzNoun())
			.replace("{weekday}", faker.date.weekday())
			.replace("{phrase}", faker.company.catchPhrase())
			.replace("{adjective}", faker.word.adjective());

		const greetings = getLocaleOptions(GREETINGS, locale);
		const greetingTemplate = faker.helpers.arrayElement(greetings);
		const greeting = greetingTemplate.replace(
			"{name}",
			primaryRecipient.firstName,
		);

		const bodyParagraphs = this.generateEmailBody(context);

		const signoffs = getLocaleOptions(SIGNOFFS, locale);
		const signoff = faker.helpers.arrayElement(signoffs);

		const text = `${greeting}\n\n${bodyParagraphs}\n\n${signoff},\n${sender.firstName}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			const htmlParagraphs = bodyParagraphs
				.split("\n")
				.filter((p) => p.trim())
				.map((p) => `<p>${this.escapeHtml(p)}</p>`)
				.join("\n");

			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p>${this.escapeHtml(greeting)}</p>
${htmlParagraphs}
<p>${this.escapeHtml(signoff)},<br>${this.escapeHtml(sender.firstName)}</p>
</body>
</html>`;
		}

		return result;
	}

	private generateReply(context: GenerationContext): EmailContent {
		const { faker, sender, parentMessage, requestHtml, locale } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for reply");
		}

		const responseStarters = getLocaleOptions(RESPONSE_STARTERS, locale);
		const response = faker.helpers.arrayElement(responseStarters);
		const body = this.generateReplyBody(context);

		const signoffs = getLocaleOptions(SIGNOFFS, locale);
		const signoffOptions = [...signoffs, `-${sender.firstName}`];
		const signoff = faker.helpers.arrayElement(signoffOptions);

		const text = `${response}\n\n${body}\n\n${signoff}`;

		// Handle Re: prefix - don't double it
		const subject = parentMessage.subject.startsWith("Re:")
			? parentMessage.subject
			: `Re: ${parentMessage.subject}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p>${this.escapeHtml(response)}</p>
<p>${this.escapeHtml(body)}</p>
<p>${this.escapeHtml(signoff)}</p>
</body>
</html>`;
		}

		return result;
	}

	private generateForward(context: GenerationContext): EmailContent {
		const { faker, parentMessage, requestHtml, locale } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for forward");
		}

		const introductions = getLocaleOptions(FORWARD_INTROS, locale);
		const intro = faker.helpers.arrayElement(introductions);

		// Remove existing Fwd: prefix if present
		const cleanSubject = parentMessage.subject.replace(/^Fwd:\s*/i, "");
		const subject = `Fwd: ${cleanSubject}`;

		const forwardHeader = `---------- Forwarded message ----------
From: ${parentMessage.from.firstName} ${parentMessage.from.lastName} <${parentMessage.from.email}>
Date: ${parentMessage.date.toUTCString()}
Subject: ${parentMessage.subject}`;

		const text = `${intro}\n\n${forwardHeader}\n\n${parentMessage.bodyExcerpt}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p>${this.escapeHtml(intro)}</p>
<hr>
<div style="margin-left: 1em; padding-left: 1em; border-left: 2px solid #ccc;">
<p><strong>From:</strong> ${this.escapeHtml(parentMessage.from.firstName)} ${this.escapeHtml(parentMessage.from.lastName)} &lt;${this.escapeHtml(parentMessage.from.email)}&gt;<br>
<strong>Date:</strong> ${this.escapeHtml(parentMessage.date.toUTCString())}<br>
<strong>Subject:</strong> ${this.escapeHtml(parentMessage.subject)}</p>
<p>${this.escapeHtml(parentMessage.bodyExcerpt)}</p>
</div>
</body>
</html>`;
		}

		return result;
	}

	/**
	 * Generate contextual email body content instead of lorem ipsum.
	 */
	private generateEmailBody(context: GenerationContext): string {
		const { faker, locale } = context;

		const paragraphTemplates = getLocaleOptions(BODY_PARAGRAPHS, locale);
		const followUpTemplates = getLocaleOptions(FOLLOW_UPS, locale);

		const paragraphCount = faker.number.int({ min: 1, max: 3 });
		const paragraphs: string[] = [];

		for (let i = 0; i < paragraphCount; i++) {
			const template = faker.helpers.arrayElement(paragraphTemplates);
			const paragraph = template
				.replace("{noun}", faker.company.buzzNoun())
				.replace("{phrase}", faker.company.catchPhrase().toLowerCase());
			paragraphs.push(paragraph);
		}

		if (faker.datatype.boolean()) {
			paragraphs.push(faker.helpers.arrayElement(followUpTemplates));
		}

		return paragraphs.join("\n\n");
	}

	/**
	 * Generate contextual reply body content.
	 */
	private generateReplyBody(context: GenerationContext): string {
		const { faker, locale } = context;

		const replyBodies = getLocaleOptions(REPLY_BODIES, locale);
		return faker.helpers.arrayElement(replyBodies);
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}
