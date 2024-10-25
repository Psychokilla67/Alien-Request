// Variable globale pour suivre l'état d'ouverture du module
let isModuleOpen = false;
let dialogInstance = null;
const SOCKET_NAME = 'module.alien-request';
let rollResults = {};

// Fonction pour initialiser le module
Hooks.once('init', () => {
    game.settings.register("alien-request", "language", {
        name: "Language",
        hint: "Select the language for the Alien Request module",
        scope: "client",
        config: true,
        type: String,
        choices: {
            "en": "English",
            "fr": "Français",
            "de": "Deutsch",
            "es": "Español"
        },
        default: "en",
        onChange: async (value) => {
            await game.i18n.setLanguage(value);
            ui.notifications.info(game.i18n.localize("ALIENREQUEST.LanguageChanged"), {permanent: false});
            updateModuleLanguage();
        }
    });
});

Hooks.once('ready', () => {
    init();
    updateModuleLanguage();
});

function init() {
    addChatButton();
    game.socket.on(SOCKET_NAME, async (data) => {
        if (data.action === 'removeMessage') {
            const messageElement = document.getElementById(`message-${data.messageId}`);
            if (messageElement) {
                messageElement.remove();
            }
        } else if (data.action === 'updateRollResult') {
            updateTokenRollResult(data.tokenId, data.rollResult);
        }
    });
}

function updateModuleLanguage() {
    // Mettre à jour tous les éléments qui nécessitent une traduction
    if (dialogInstance) {
        dialogInstance.close();
        createTokenSelectionDialog();
    }
    updateChatButton();
    // Mettre à jour d'autres éléments si nécessaire
    // Par exemple, mettre à jour les titres, les étiquettes, etc.
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        el.textContent = game.i18n.localize(key);
    });
}

function updateChatButton() {
    const chatButton = document.querySelector("#chat-controls button[title]");
    if (chatButton) {
        chatButton.title = game.i18n.localize("ALIENREQUEST.OpenCloseAlienRequest");
    }
}

// Ajouter un bouton dans la barre de chat
function addChatButton() {
    const chatControls = document.querySelector("#chat-controls");
    if (chatControls && !chatControls.querySelector(".alien-request-button")) {
        const button = document.createElement("button");
        button.innerHTML = '<i class="fas fa-dice-d20"></i>';
        button.title = game.i18n.localize("ALIENREQUEST.OpenCloseAlienRequest");
        button.onclick = toggleTokenSelectionDialog;
        button.classList.add("alien-request-button");
        chatControls.appendChild(button);
    }
}

// Fonction pour initialiser le module
// Hooks.once('ready', () => {
//     init();
// });

// function init() {
//     addChatButton();
//     game.socket.on(SOCKET_NAME, async (data) => {
//         if (data.action === 'removeMessage') {
//             const messageElement = document.getElementById(`message-${data.messageId}`);
//             if (messageElement) {
//                 messageElement.remove();
//             }
//         } else if (data.action === 'updateRollResult') {
//             updateTokenRollResult(data.tokenId, data.rollResult);
//         }
//     });
// }



// Fonction pour ouvrir ou fermer le dialogue
function toggleTokenSelectionDialog() {
    if (isModuleOpen) {
        closeTokenSelectionDialog();
    } else {
        createTokenSelectionDialog();
    }
}

// Fonction pour fermer le dialogue
function closeTokenSelectionDialog() {
    if (dialogInstance) {
        dialogInstance.close();
    }
    isModuleOpen = false;
}


// Ajoutez nouveau Token
function addSelectedTokenToList(html) {
    const selectedTokens = canvas.tokens.controlled;
    if (selectedTokens.length === 0) {
        ui.notifications.warn("Veuillez sélectionner un token sur la scène.");
        return;
    }

    const tokenList = html.find("#tokenList");
    selectedTokens.forEach(token => {
        if (!tokenList.find(`#token-${token.id}`).length) {
            const tokenInfo = {
                id: token.id,
                name: token.name,
                attributes: {
                    str: token.actor.system.attributes?.str?.value ?? 0,
                    agl: token.actor.system.attributes?.agl?.value ?? 0,
                    wit: token.actor.system.attributes?.wit?.value ?? 0,
                    emp: token.actor.system.attributes?.emp?.value ?? 0
                },
                skills: {
                    heavyMach: token.actor.system.skills?.heavyMachinery?.value ?? 0,
                    closeCbt: token.actor.system.skills?.closeCombat?.value ?? 0,
                    stamina: token.actor.system.skills?.stamina?.value ?? 0,
                    rangedCbt: token.actor.system.skills?.rangedCombat?.value ?? 0,
                    mobility: token.actor.system.skills?.mobility?.value ?? 0,
                    piloting: token.actor.system.skills?.piloting?.value ?? 0,
                    command: token.actor.system.skills?.command?.value ?? 0,
                    manipulation: token.actor.system.skills?.manipulation?.value ?? 0,
                    medicalAid: token.actor.system.skills?.medicalAid?.value ?? 0,
                    observation: token.actor.system.skills?.observation?.value ?? 0,
                    survival: token.actor.system.skills?.survival?.value ?? 0,
                    comtech: token.actor.system.skills?.comtech?.value ?? 0
                },
                stress: token.actor.system.header?.stress?.value ?? 0
            };
            window.tokenDataArray.push(tokenInfo);

            tokenList.append(`
                <div class="token-item">
                    <input type="checkbox" id="token-${token.id}" value="${token.id}">
                    <label for="token-${token.id}">
                        <img src="${token.document.texture.src}" alt="${token.name}">
                        ${token.name}
                    </label>
                    <span class="roll-result" id="roll-result-${token.id}"></span>
                </div>
            `);
        }
    });

    updateTokenSelection(html);
    attachEventListeners(html);
}

//nouvelle function ou écouter
function attachEventListeners(html) {
    html.find('#tokenList input[type="checkbox"]').off('change').on('change', () => updateTokenSelection(html));
    html.find('#rollDice').off('click').on('click', initiateRoll);
}

// Créer la fenêtre modale pour sélectionner les tokens
function createTokenSelectionDialog() {
    if (isModuleOpen) return;
    isModuleOpen = true;

    const dialogContent = `
    <style>
        .token-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 5px;
        }
        .token-item {
            display: flex;
            align-items: center;
            padding: 5px;
            border: 1px solid #ccc;
            border-radius: 5px;
            background-color: #00000000;
        }
        .token-item:hover {
            background-color: #e9e9e9;
        }
        .token-item img {
            width: 40px;
            height: 40px;
            margin-right: 10px;
            border-radius: 50%;
        }
        .token-item label {
            color: #18520b;
            font-weight: bold;
            display: flex;
            align-items: center;
            width: 100%;
        }
        #addSelectedToken {
            margin-top: 10px;
            width: 100%;
            padding: 5px;
        }
        .roll-result {
            margin-left: 10px;
            font-weight: bold;
        }
        #attributesList, #skillsList {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
        }
        #attributesList div, #skillsList div {
            display: flex;
            align-items: center;
        }
        #attributesList label, #skillsList label {
            margin-left: 5px;
        }
        .dice-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .dice-table th, .dice-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .dice-table th {
            background-color: #f2f2f2;
        }
    
        h2.centered-title, h3.centered-title {
            text-align: center;
        }
        #addSelectedToken {
            display: block;
            margin: 10px auto;
            width: 400px;
            height: 50px;
            font-size: 14px;
        }
        .checkbox-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            font-weight: bold;
        }
            .support-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
        }
        .support-text {
            margin-right: 10px;
            font-weight: bold;
        }
        .support-button {
            width: 156px;
            height: 48px;
            cursor: pointer;
        }
            
    </style>
    <div>
        <div class="support-container">
            <img src="modules/alien-request/icons/tipeee_tip_btn.png" class="support-button" title="${game.i18n.localize("ALIENREQUEST.SupportMeTipeee")}" onclick="window.open('https://fr.tipeee.com/shaz-prod/', '_blank')">
            <span style="font-size: 1.5em; font-weight: bold; margin: 0 10px; text-align: center;">${game.i18n.localize("ALIENREQUEST.SupportMyWork")}</span>
            <img src="modules/alien-request/icons/support_me_on_kofi_blue.webp" class="support-button" title="${game.i18n.localize("ALIENREQUEST.SupportMeKofi")}" onclick="window.open('https://ko-fi.com/shazprod', '_blank')">
        </div>
        <h2 class="centered-title" style="font-weight: bold;">${game.i18n.localize("ALIENREQUEST.SelectTokens")}</h2>
        <div id="tokenList" class="token-grid"></div>
        
        <button id="addSelectedToken" style="font-weight: bold;">${game.i18n.localize("ALIENREQUEST.AddSelectedToken")}</button>
        <hr/>
        <h3 class="centered-title" style="font-weight: bold;">${game.i18n.localize("ALIENREQUEST.Attributes")}</h3>
        <div id="attributesList"></div>
        <hr/>
        <h3 class="centered-title" style="font-weight: bold;">${game.i18n.localize("ALIENREQUEST.Skills")}</h3>
        <div id="skillsList"></div>
        <hr/>
        <h3 class="centered-title" style="font-weight: bold;">${game.i18n.localize("ALIENREQUEST.Request")}</h3>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 10px;">
            <div style="text-align: center;">
                <label for="negativeModifier" style="display: block; font-weight: bold;">${game.i18n.localize("ALIENREQUEST.Decreased")}</label>
                <input type="number" id="negativeModifier" value="0" style="color: red; font-weight: bold; width: 50px; text-align: center;">
            </div>
            <button id="rollDice" style="width: 400px; height: 50px; font-size: 14px; font-weight: bold;">${game.i18n.localize("ALIENREQUEST.RollDice")}</button>
            <div style="text-align: center;">
                <label for="addDice" style="display: block; font-weight: bold;">${game.i18n.localize("ALIENREQUEST.Increased")}</label>
                <input id="addDice" type="number" value="0" style="color: green; font-weight: bold; width: 50px; text-align: center;" placeholder="+ Dés">
            </div>
        </div>
        <div class="checkbox-container">
            <div class="checkbox-item">
                <label for="clearGMChat">${game.i18n.localize("ALIENREQUEST.ClearChat")}</label>
                <input type="checkbox" id="clearGMChat" name="clearGMChat">
            </div>
            <div class="checkbox-item">
                <label for="rollForAbsent">${game.i18n.localize("ALIENREQUEST.RollForAbsent")}</label>
                <input type="checkbox" id="rollForAbsent" name="rollForAbsent">
            </div>
        </div>    
        <style>
            .dice-table th, .dice-table td {
                color: black;
                font-weight: normal;
                text-align: center;
            }
            .dice-icon {
                vertical-align: middle;
                margin-left: 3px;
            }
            .th-content {
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
        </style>
        <table class="dice-table">
            <thead>
                <tr>
                    <th>Token</th>
                    <th>
                        <div class="th-content">
                            ${game.i18n.localize("ALIENREQUEST.Dice")}
                            <img src="modules/alien-request/icons/alien-dice-b6.png" class="dice-icon" alt="${game.i18n.localize("ALIENREQUEST.StandardDice")}">
                        </div>
                    </th>
                    <th>
                        <div class="th-content">
                            ${game.i18n.localize("ALIENREQUEST.Dice")}
                            <img src="modules/alien-request/icons/alien-dice-y6.png" class="dice-icon" alt="${game.i18n.localize("ALIENREQUEST.StressDice")}">
                        </div>
                    </th>
                    <th>
                        <div class="th-content">
                            ${game.i18n.localize("ALIENREQUEST.Dice")}
                            <img src="modules/alien-request/icons/alien-dice-y1.png" class="dice-icon" alt="${game.i18n.localize("ALIENREQUEST.FacehuggerDice")}">
                        </div>
                    </th>
                    <th>${game.i18n.localize("ALIENREQUEST.Status")}</th>
                </tr>
            </thead>
            <tbody id="diceTableBody">
                <!-- Les lignes du tableau seront ajoutées ici dynamiquement -->
            </tbody>
        </table>
    </div>
    `;

    const tokenData = canvas.tokens.placeables.filter(token => {
        return token.actor && 
               token.actor.type !== "creature" && 
               token.document.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    });
    console.log("Tokens amicaux trouvés:", tokenData);

    if (tokenData.length === 0) {
        ui.notifications.warn(game.i18n.localize("ALIENREQUEST.NoFriendlyTokens"));
        isModuleOpen = false;
        return;
    }

    dialogInstance = new Dialog({
        title: game.i18n.localize("ALIENREQUEST.RollDiceTitle"),
        content: dialogContent,
        buttons: {},
        render: (html) => {
            const tokenList = html.find("#tokenList");
            window.tokenDataArray = [];

            tokenData.forEach(token => {
                const actor = token.actor;
                if (actor && actor.system) {
                    console.log("Traitement du token:", token.name);
                    console.log("Données de l'acteur:", actor.system);
                    const tokenInfo = {
                        id: token.id,
                        name: token.name,
                        attributes: {
                            str: actor.system.attributes?.str?.value ?? 0,
                            agl: actor.system.attributes?.agl?.value ?? 0,
                            wit: actor.system.attributes?.wit?.value ?? 0,
                            emp: actor.system.attributes?.emp?.value ?? 0
                        },
                        skills: {
                            heavyMach: actor.system.skills?.heavyMachinery?.value ?? 0,
                            closeCbt: actor.system.skills?.closeCombat?.value ?? 0,
                            stamina: actor.system.skills?.stamina?.value ?? 0,
                            rangedCbt: actor.system.skills?.rangedCombat?.value ?? 0,
                            mobility: actor.system.skills?.mobility?.value ?? 0,
                            piloting: actor.system.skills?.piloting?.value ?? 0,
                            command: actor.system.skills?.command?.value ?? 0,
                            manipulation: actor.system.skills?.manipulation?.value ?? 0,
                            medicalAid: actor.system.skills?.medicalAid?.value ?? 0,
                            observation: actor.system.skills?.observation?.value ?? 0,
                            survival: actor.system.skills?.survival?.value ?? 0,
                            comtech: actor.system.skills?.comtech?.value ?? 0
                        },
                        stress: actor.system.header?.stress?.value ?? 0
                    };
                    window.tokenDataArray.push(tokenInfo);
                    console.log(`Token ${tokenInfo.name} - Stress: ${tokenInfo.stress}`);

                    tokenList.append(`
                        <div class="token-item">
                            <input type="checkbox" id="token-${token.id}" value="${token.id}">
                            <label for="token-${token.id}">
                                <img src="${token.document.texture.src}" alt="${token.name}">
                                ${token.name}
                            </label>
                            <span class="roll-result" id="roll-result-${token.id}"></span>
                        </div>
                    `);
                } else {
                    console.log("Token sans acteur ou données invalides:", token.name);
                }
            });

            console.log("tokenDataArray:", window.tokenDataArray);

            attachEventListeners(html);

            html.find("#addSelectedToken").on("click", () => addSelectedTokenToList(html));

            // Réinitialiser la case à cocher pour effacer le chat
            html.find('#clearGMChat').prop('checked', false);
            html.find('#rollForAbsent').prop('checked', false);

            updateAttributeAndSkillsList(html);
        },
        close: () => {
            console.log("Dialogue fermé");
            isModuleOpen = false;
            dialogInstance = null;
        }
    }, {width: 600});

    dialogInstance.render(true);
}
function updateAttributeAndSkillsList(html) {
    const attributesList = html.find("#attributesList");
    const skillsList = html.find("#skillsList");

    attributesList.empty();
    skillsList.empty();

    const attributeMap = {
        [game.i18n.localize("ALIENREQUEST.Strength")]: "str",
        [game.i18n.localize("ALIENREQUEST.Agility")]: "agl",
        [game.i18n.localize("ALIENREQUEST.Wits")]: "wit",
        [game.i18n.localize("ALIENREQUEST.Empathy")]: "emp"
    };
    
    const skillMap = {
        [game.i18n.localize("ALIENREQUEST.HeavyMachinery")]: "heavyMach",
        [game.i18n.localize("ALIENREQUEST.RangedCombat")]: "rangedCbt",
        [game.i18n.localize("ALIENREQUEST.Observation")]: "observation",
        [game.i18n.localize("ALIENREQUEST.Command")]: "command",
        [game.i18n.localize("ALIENREQUEST.CloseCombat")]: "closeCbt",
        [game.i18n.localize("ALIENREQUEST.Mobility")]: "mobility",
        [game.i18n.localize("ALIENREQUEST.Survival")]: "survival",
        [game.i18n.localize("ALIENREQUEST.Manipulation")]: "manipulation",
        [game.i18n.localize("ALIENREQUEST.Stamina")]: "stamina",
        [game.i18n.localize("ALIENREQUEST.Piloting")]: "piloting",
        [game.i18n.localize("ALIENREQUEST.Comtech")]: "comtech",
        [game.i18n.localize("ALIENREQUEST.MedicalAid")]: "medicalAid"
    };

    for (const [attributeName, attributeKey] of Object.entries(attributeMap)) {
        attributesList.append(`
            <div>
                <input type="radio" id="${attributeKey}" name="selectedAttribute" value="${attributeKey}" data-name="${attributeName}">
                <label for="${attributeKey}">${attributeName}</label>
            </div>
        `);
    }

    for (const [skillName, skillKey] of Object.entries(skillMap)) {
        skillsList.append(`
            <div>
                <input type="radio" id="${skillKey}" name="selectedSkill" value="${skillKey}" data-name="${skillName}">
                <label for="${skillKey}">${skillName}</label>
            </div>
        `);
    }

    // Ajouter des écouteurs d'événements pour la désélection
    html.find('input[name="selectedAttribute"]').on('change', function() {
        if (this.checked) {
            html.find('input[name="selectedSkill"]').prop('checked', false);
        }
    });

    html.find('input[name="selectedSkill"]').on('change', function() {
        if (this.checked) {
            html.find('input[name="selectedAttribute"]').prop('checked', false);
        }
    });
}

//function pour supper le chat gm
function clearGMChat() {
    if (game.user.isGM) {
        game.messages.documentClass.deleteDocuments(
            game.messages.map(m => m.id),
            {deleteAll: true}
        );
        ui.notifications.info(game.i18n.localize("ALIENREQUEST.ChatCleared"));
    }
}


async function initiateRoll() {
    const selectedTokens = Array.from(document.querySelectorAll('#tokenList input:checked')).map(input => input.value);
    selectedTokenIds = selectedTokens;
    console.log("Tokens sélectionnés:", selectedTokenIds);
    const selectedAttribute = document.querySelector('input[name="selectedAttribute"]:checked');
    const selectedSkill = document.querySelector('input[name="selectedSkill"]:checked');

    console.log("Attribut sélectionné:", selectedAttribute);
    console.log("Compétence sélectionnée:", selectedSkill);

    if (selectedTokens.length === 0 || (!selectedAttribute && !selectedSkill)) {
        ui.notifications.warn(game.i18n.localize("ALIENREQUEST.SelectTokenAndAttribute"));
        return;
    }

    // Vérifier si la case "Effacer le chat" est cochée
    const clearChatCheckbox = document.getElementById('clearGMChat');
    if (clearChatCheckbox && clearChatCheckbox.checked) {
        clearGMChat();
    }

    const rollType = selectedAttribute ? selectedAttribute.value : selectedSkill.value;
    const rollName = selectedAttribute ? selectedAttribute.dataset.name : selectedSkill.dataset.name;
    console.log("Type de lancer:", rollType);
    console.log("Nom du lancer:", rollName);

    // Vérifier si la case "Lancer pour les absents" est cochée
    const rollForAbsentCheckbox = document.getElementById('rollForAbsent');
    const rollForAbsent = rollForAbsentCheckbox && rollForAbsentCheckbox.checked;

    // Continuer avec le lancer de dés
    for (const tokenId of selectedTokens) {
        await rollDice(tokenId, rollType, rollName, rollForAbsent);
        console.log("tokenId", tokenId, rollType, rollName);
    }

    // Mettre à jour le stress pour chaque token sélectionné
    for (const tokenId of selectedTokens) {
        updateTokenStress(tokenId);
    }

    // // Continuer avec le lancer de dés
    // for (const tokenId of selectedTokens) {
    //     await rollDice(tokenId, rollType, rollName);
    //     console.log("tokenId", tokenId, rollType, rollName);
    // }

    // Attendre un court instant pour que tous les lancers soient effectués
    await new Promise(resolve => setTimeout(resolve, 100));
}

    
function updateTokenSelection(html) {
    // Récupérer les IDs des tokens sélectionnés
    const selectedTokenIds = Array.from(html.find('#tokenList input:checked')).map(input => input.value);
    console.log("Tokens sélectionnés:", selectedTokenIds);

    // Récupérer le corps du tableau
    const tableBody = html.find('#diceTableBody');
    // Vider le tableau existant
    tableBody.empty();

    
    // Mettre à jour l'affichage des attributs et compétences si nécessaire
    updateAttributeAndSkillsList(html);

    // Activer ou désactiver le bouton de lancer de dés en fonction de la sélection
    const rollDiceButton = html.find('#rollDice');
    rollDiceButton.prop('disabled', selectedTokenIds.length === 0);

    // Mettre à jour le compteur de tokens sélectionnés si vous en avez un
    const selectedCount = html.find('#selectedTokenCount');
    if (selectedCount.length) {
        selectedCount.text(selectedTokenIds.length);
    }
}
   

// Fonction pour réinitialiser les sélections
function resetSelections() {
   

    // Réinitialiser les modificateurs
    document.getElementById('negativeModifier').value = 0;
    document.getElementById('addDice').value = 0;

    
}

async function rollDice(tokenId, rollType, rollName, rollForAbsent) {
    const token = canvas.tokens.get(tokenId);
    if (!token) {
        console.error(`Token with ID ${tokenId} not found`);
        return;
    }
    console.log(token.actor.system.skills)

    const tokenData = window.tokenDataArray.find(t => t.id === tokenId);
    if (!tokenData) {
        console.error(`Token data not found for ID ${tokenId}`);
        return;
    }

    // Récupérer le stress actuel du token au moment du lancer
    const currentStress = token.actor.system.header.stress.value;
    tokenData.stress = currentStress; // Mettre à jour la valeur de stress dans tokenData
    console.log(`Stress actuel pour ${token.name}: ${currentStress}`);

    const isAttribute = Object.keys(tokenData.attributes).includes(rollType);
    let diceValue = isAttribute ? getAttributeFromToken(token, rollType) : getSkillFromToken(token, rollType);

    // Ajouter l'attribut correspondant si c'est une compétence
    if (!isAttribute) {
        console.log("bob")
        const skillAttributeMap = {
            heavyMach: 'str', closeCbt: 'str', stamina: 'str',
            rangedCbt: 'agl', mobility: 'agl', piloting: 'agl',
            command: 'emp', manipulation: 'emp', medicalAid: 'emp',
            observation: 'wit', survival: 'wit', comtech: 'wit'
        };
        const attributeToAdd = skillAttributeMap[rollType];
        if (attributeToAdd) {
            console.log(getSkillFromToken(token,rollType))
            diceValue += getAttributeFromToken(token, attributeToAdd);
        }
    }

    const negativeModifier = parseInt(document.getElementById('negativeModifier').value) || 0;
    const positiveModifier = parseInt(document.getElementById('addDice').value) || 0;

    const finalDiceValue = Math.max(0, diceValue - negativeModifier + positiveModifier);
    console.log(`Lancer pour ${token.name}: ${finalDiceValue} dés, Stress: ${currentStress}`);
    console.log("rollName", rollName)

    const chatMessageData = {
        speaker: ChatMessage.getSpeaker({ token: token }),
        content: `
    <h3>${game.i18n.format("ALIENREQUEST.RollRequest", {tokenName: token.name, rollName: rollName})}</h3>
    <button class="alien-request-roll" 
        data-token-id="${tokenId}" 
        data-actor-id="${token.actor.id}"
        data-roll-name="${rollName}" 
        data-final-dice-value="${finalDiceValue}" 
        data-stress="${currentStress}">
        ${game.i18n.format("ALIENREQUEST.RollDice2", {diceCount: finalDiceValue})}
    </button>
    `,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        flags: { 
            "alien-request": { 
                interactiveButton: true,
                ownerId: game.user.id
            } 
        }
    };

     // Déterminer les destinataires du message
    const gmUsers = game.users.filter(u => u.isGM);
    const owningPlayer = token.actor.hasPlayerOwner ? game.users.find(u => u.character === token.actor) : null;
 
    if (owningPlayer && owningPlayer.active) {
        // Le joueur est en ligne, envoyer uniquement au joueur
        chatMessageData.whisper = [owningPlayer.id];
        chatMessageData.blind = true;
        let chatMessage = await ChatMessage.create(chatMessageData);
    } else if (!owningPlayer || (owningPlayer && !owningPlayer.active && rollForAbsent)) {
        // Le joueur est hors ligne ou le token n'a pas de propriétaire, et on lance pour les absents
        await game.alienrpg.yze.yzeRoll(
            'character',
            false,
            false,
            rollName,
            finalDiceValue,
            game.i18n.localize('ALIENRPG.Black'),
            currentStress,
            game.i18n.localize('ALIENRPG.Yellow'),
            token.actor.id,
            'Alien RPG',
            1
        );
    } else if (game.user.isGM) {
        // C'est un GM qui fait la demande pour un token sans propriétaire
        chatMessageData.whisper = gmUsers.map(u => u.id);
        let chatMessage = await ChatMessage.create(chatMessageData);
    }
}


// Fonction pour mettre à jour le résultat du lancer dans la liste des tokens
function updateTokenRollResult(tokenId, rollResult) {
    const resultSpan = document.getElementById(`roll-result-${tokenId}`);
    console.log("resultSpan ligne 503", resultSpan, tokenId)
    if (resultSpan) {
        resultSpan.textContent = rollResult;
    }
}

// Appeler la fonction pour initialiser le module lorsque Foundry est prêt
Hooks.once('ready', () => {
    init();
});



function processPanicMessage(panicMessage, rollMessage) {
    console.log("Traitement du message de panique:", panicMessage.content);
    
    const tokenId = rollMessage.speaker.token;
    if (tokenId && rollResults[tokenId]) {
        rollResults[tokenId].isPanic = true;
        updateResultsTable(tokenId);
    }
}

function updateResultsTable(id) {
    console.log("Mise à jour du tableau pour l'ID", id);
    const tableBody = document.getElementById('diceTableBody');
    if (!tableBody) {
        console.error("Corps du tableau non trouvé");
        return;
    }

    let row = tableBody.querySelector(`tr[data-id="${id}"]`);
    if (!row) {
        console.log("Création d'une nouvelle ligne pour l'ID", id);
        row = tableBody.insertRow();
        row.setAttribute('data-id', id);
        for (let i = 0; i < 5; i++) {
            row.insertCell();
        }
    }

    const result = rollResults[id];
    console.log("Résultats à afficher:", result);
    if (result) {
        const token = canvas.tokens.get(id);
        const actor = token?.actor || game.actors.get(id);
        if (row.cells[0]) {
            const tokenImg = token ? token.document.texture.src : "";
            row.cells[0].innerHTML = `
                <div style="display: flex; align-items: center;">
                    <img src="${tokenImg}" alt="${actor ? actor.name : 'Inconnu'}" style="width: 30px; height: 30px; margin-right: 5px; border-radius: 50%;">
                    <span>${actor ? actor.name : 'Inconnu'}</span>
                </div>
            `;
        }
        if (row.cells[1]) row.cells[1].textContent = result.standardSixes || '0';
        if (row.cells[2]) row.cells[2].textContent = result.stressSixes || '0';
        if (row.cells[3]) row.cells[3].textContent = result.stressOnes || '0';
        
        if (row.cells[4]) {
            console.log("Mise à jour de la cellule PANIQUE, isPanic:", result.isPanic);
            if (result.isPanic) {
                console.log("Affichage de PANIQUE");
                row.cells[4].textContent = game.i18n.localize("ALIENREQUEST.Panic");
                row.cells[4].setAttribute('style', 'background-color: red !important; color: white !important; font-weight: bold !important; cursor: help;');
                if (result.panicMessage) {
                    console.log("Message de panique brut:", result.panicMessage);
                    // Nettoyer et formater le contenu de l'infobulle
                    const cleanContent = cleanPanicMessage(result.panicMessage);
                    console.log("Contenu nettoyé de l'infobulle:", cleanContent);
                    row.cells[4].title = cleanContent;
                }
            } else {
                console.log("Effacement de PANIQUE");
                row.cells[4].textContent = "";
                row.cells[4].removeAttribute('style');
                row.cells[4].removeAttribute('title');
            }
        }
    } else {
        console.error("Pas de résultats trouvés pour l'ID", id);
    }
    console.log("Contenu du tableau après mise à jour:", tableBody.innerHTML);
}

function cleanPanicMessage(htmlContent) {
    // Créer un élément div temporaire pour parser le HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Fonction pour extraire le texte d'un élément et ses enfants
    function extractText(element, depth = 0) {
        let text = '';
        for (let node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                let nodeText = node.textContent.trim();
                if (nodeText) {
                    text += nodeText + '\n';
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (['H2', 'H3', 'H4'].includes(node.tagName)) {
                    text += '\n' + '  '.repeat(depth) + node.textContent.trim() + '\n';
                } else if (node.tagName === 'I' && node.firstElementChild?.tagName === 'B' && node.firstElementChild.firstElementChild?.tagName === 'B') {
                    // Ajouter un retour à la ligne pour <i><b><b>
                    text += '\n' + extractText(node, depth + 1);
                } else {
                    text += extractText(node, depth + 1);
                }
            }
        }
        return text;
    }

    // Extraire le texte avec la structure
    let cleanText = extractText(tempDiv);

    // Nettoyer les retours à la ligne multiples et les espaces en début/fin
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

    return cleanText;
}

Hooks.on('renderChatMessage', (message, html, data) => {
    if (message.getFlag("alien-request", "interactiveButton")) {
        const button = html.find(".alien-request-roll");
        button.click(async (event) => {
            event.preventDefault();
            button.prop('disabled', true);
            button.css('opacity', '0.5');

            const tokenId = button.data('tokenId');
            const rollName = button.data('rollName');
            const finalDiceValue = parseInt(button.data('finalDiceValue'));
            const stress = parseInt(button.data('stress'));
            const actorId = button.data('actorId');

            await game.alienrpg.yze.yzeRoll(
                'character',
                false,
                false,
                rollName,
                finalDiceValue,
                game.i18n.localize('ALIENRPG.Black'),
                stress,
                game.i18n.localize('ALIENRPG.Yellow'),
                actorId,
                'Alien RPG',
                1
            );

            // Attendre un court instant pour que le hook createChatMessage soit déclenché
            await new Promise(resolve => setTimeout(resolve, 100));

            if (rollResults[tokenId]) {
                const result = rollResults[tokenId];
                const rollResult = `${result.standardSixes} succès, ${result.stressSixes} stress, ${result.stressOnes} panique`;
                game.socket.emit(SOCKET_NAME, {
                    action: 'updateRollResult',
                    tokenId: tokenId,
                    rollResult: rollResult
                });
            }

            // Supprimer l'élément HTML du message
            const messageElement = html.closest('.message');
            if (messageElement) {
                messageElement.remove();
            }

            // Informer les autres clients de supprimer le message
            game.socket.emit(SOCKET_NAME, {
                action: 'removeMessage',
                messageId: message.id
            });
        });
    }
});

// let lastRollMessage = null;

let lastTwoRollMessages = [];

// Hook pour intercepter les messages de chat
Hooks.on('createChatMessage', (chatMessage) => {
    console.log("Nouveau message de chat:", chatMessage);
    console.log("Contenu du message:", chatMessage.content);

    if (chatMessage.content && chatMessage.content.includes(game.i18n.localize("ALIENREQUEST.PanicStateKeyword"))) {
        console.log("Message d'état de panique détecté");
        if (lastTwoRollMessages.length > 0) {
            processPanicRoll(chatMessage, lastTwoRollMessages[lastTwoRollMessages.length - 1]);
        } else {
            console.log("Pas de message de lancer précédent pour traiter l'état de panique");
        }
    } else if (chatMessage.isRoll && chatMessage.rolls && chatMessage.rolls.length > 0) {
        console.log("Message de lancer de dés détecté");
        lastTwoRollMessages.push(chatMessage);
        if (lastTwoRollMessages.length > 2) {
            lastTwoRollMessages.shift();
        }
        processStandardRoll(chatMessage);
    } else {
        console.log("Message non traité");
    }
});

function processStandardRoll(chatMessage) {
    const roll = chatMessage.rolls[0];
    if (roll.terms && Array.isArray(roll.terms)) {
        let standardSixes = 0;
        let stressSixes = 0;
        let stressOnes = 0;

        roll.terms.forEach((term, index) => {
            if (term.results && Array.isArray(term.results)) {
                if (index === 0) {
                    standardSixes = term.results.filter(d => d.result === 6).length;
                } else {
                    stressSixes += term.results.filter(d => d.result === 6).length;
                    stressOnes += term.results.filter(d => d.result === 1).length;
                }
            }
        });

        // Récupérer l'ID de l'acteur à partir du contenu HTML du message
        const content = chatMessage.content;
        const actorIdMatch = content.match(/data-actor-id="([^"]+)"/);
        const actorId = actorIdMatch ? actorIdMatch[1] : null;

        if (actorId) {
            const token = canvas.tokens.placeables.find(t => t.actor?.id === actorId);
            if (token) {
                const tokenId = token.id;
                rollResults[tokenId] = {
                    standardSixes,
                    stressSixes,
                    stressOnes,
                    isPanic: false
                };
                updateResultsTable(tokenId);
            } else {
                console.error("Aucun token trouvé pour l'acteur", actorId);
            }
        } else {
            console.error("Aucun acteur associé à ce lancer");
        }
    }
}

// Nouvelle fonction pour obtenir un token par son ID
function getTokenById(tokenId) {
    return game.scenes.active.tokens.find(t => t.id === tokenId);
}

function processPanicRoll(panicMessage, previousRollMessage) {
    console.log("Traitement du lancer de panique:", panicMessage);

    const content = previousRollMessage.content;
    const actorIdMatch = content.match(/data-actor-id="([^"]+)"/);
    const actorId = actorIdMatch ? actorIdMatch[1] : null;

    if (actorId) {
        const token = canvas.tokens.placeables.find(t => t.actor?.id === actorId);
        if (token) {
            const tokenId = token.id;
            if (!rollResults[tokenId]) {
                rollResults[tokenId] = {
                    standardSixes: 0,
                    stressSixes: 0,
                    stressOnes: 0,
                    isPanic: false,
                    panicMessage: ''
                };
            }

            rollResults[tokenId].isPanic = true;
            rollResults[tokenId].panicMessage = panicMessage.content || game.i18n.localize("ALIENREQUEST.DefaultPanicState");
            updateResultsTable(tokenId);
        } else {
            console.error("Aucun token trouvé pour l'acteur", actorId);
        }
    } else {
        console.error("Aucun acteur associé au lancer de panique");
    }
}


function updateResultsTable(id) {
    console.log("Mise à jour du tableau pour l'ID", id);
    const tableBody = document.getElementById('diceTableBody');
    if (!tableBody) {
        console.error("Corps du tableau non trouvé");
        return;
    }

    let row = tableBody.querySelector(`tr[data-id="${id}"]`);
    if (!row) {
        console.log("Création d'une nouvelle ligne pour l'ID", id);
        row = tableBody.insertRow();
        row.setAttribute('data-id', id);
        for (let i = 0; i < 5; i++) {
            row.insertCell();
        }
    }

    const result = rollResults[id];
    console.log("Résultats à afficher:", result);
    if (result) {
        const tokenData = window.tokenDataArray.find(t => t.id === id);
        if (row.cells[0]) {
            const tokenImg = tokenData?.imgSrc || "";
            const imgElement = document.createElement('img');
            imgElement.src = tokenImg;
            imgElement.alt = tokenData?.name || 'Inconnu';
            imgElement.style = "width: 30px; height: 30px; margin-right: 5px; border-radius: 50%; object-fit: cover;";
            imgElement.onerror = function() {
                this.src = 'systems/alienrpg/images/icons/alien-skull.svg'; // Image par défaut du système Alien RPG
            };

            row.cells[0].innerHTML = '';
            const div = document.createElement('div');
            div.style = "display: flex; align-items: center;";
            div.appendChild(imgElement);
            div.appendChild(document.createTextNode(tokenData?.name || 'Inconnu'));
            row.cells[0].appendChild(div);
        }
        if (row.cells[1]) row.cells[1].textContent = result.standardSixes || '0';
        if (row.cells[2]) row.cells[2].textContent = result.stressSixes || '0';
        if (row.cells[3]) row.cells[3].textContent = result.stressOnes || '0';
        
        if (row.cells[4]) {
            console.log("Mise à jour de la cellule PANIQUE, isPanic:", result.isPanic);
            if (result.isPanic) {
                console.log("Affichage de PANIQUE");
                row.cells[4].textContent = game.i18n.localize("ALIENREQUEST.PanicStatus");
                row.cells[4].setAttribute('style', 'background-color: red !important; color: white !important; font-weight: bold !important; cursor: help;');
                if (result.panicMessage) {
                    console.log("Message de panique brut:", result.panicMessage);
                    const cleanContent = cleanPanicMessage(result.panicMessage);
                    console.log("Contenu nettoyé de l'infobulle:", cleanContent);
                    row.cells[4].title = cleanContent;
                }
            } else {
                console.log("Effacement de PANIQUE");
                row.cells[4].textContent = "";
                row.cells[4].removeAttribute('style');
                row.cells[4].removeAttribute('title');
            }
        }
    } else {
        console.error("Pas de résultats trouvés pour l'ID", id);
    }
    console.log("Contenu du tableau après mise à jour:", tableBody.innerHTML);
}

// Fonction pour nettoyer le contenu de l'infobulle
function cleanTooltipContent(content) {
    // Créer un élément div temporaire
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Extraire le texte sans les balises HTML
    const cleanedText = tempDiv.textContent || tempDiv.innerText || "";

    // Supprimer les sauts de ligne multiples et les espaces en trop
    return cleanedText.replace(/\s+/g, ' ').trim();
}
 
//Renvoie la valeur de skill d'un token
function getSkillFromToken(token, skillName) {
    return token?.actor?.system?.skills[skillName].value ?? null; 
}

// Renvoie la valeur d'attribut d'un token
function getAttributeFromToken(token, attributeName) {
    return token?.actor?.system?.attributes[attributeName].value ?? null; 
}


//update du stress d'un token
async function updateTokenStress(tokenId) {
    const token = canvas.tokens.get(tokenId);
    if (!token || !token.actor) {
        console.error(`Token or actor not found for ID ${tokenId}`);
        return;
    }

    let tokenData = window.tokenDataArray.find(t => t.id === tokenId);
    if (!tokenData) {
        // Si le token n'existe pas dans le tableau, créez-le
        tokenData = {
            id: tokenId,
            name: token.name,
            imgSrc: token.document.texture.src,
            // ... autres propriétés nécessaires ...
        };
        window.tokenDataArray.push(tokenData);
    } else {
        // Mise à jour de l'URL de l'image si le token existe déjà
        tokenData.imgSrc = token.document.texture.src;
    }

    // Récupérer le stress actuel directement depuis l'acteur du token
    const currentStress = token.actor.system.header.stress.value;
    
    // Mettre à jour la valeur de stress dans tokenData
    tokenData.stress = currentStress;

    console.log(`Stress mis à jour pour ${token.name}: ${currentStress}`);

    return currentStress;
}