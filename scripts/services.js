/* exported Services */
/* global alignments */
/* global checkMonster */
/* global crList */
/* global d */
/* global environments */
/* global generateRandomEncounter */
/* global getMultiplier */
/* global getShuffledMonsterList */
/* global levels */
/* global monsters */
/* global monstersById */
/* global partialFactory */
/* global sourceFilters */
/* global sources */
/* global tags */
/* global sizes */
/* global types */
"use strict";

var Services = {
	combat: function (store, encounter, monsters, util) {
		var combat = {
			active: 0,
			combatants: [],
			delta: 0,
			addMonster: function (monster, qty) {
				qty = qty || 1;

				var i, name;

				for ( i = 0; i < qty; i++ ) {
					name = [ monster.name ];

					if ( qty > 1 ) {
						name.push( i + 1 );
					}

					combat.combatants.push({
						type: "enemy",
						name: name.join(" "),
						ac: monster.ac,
						hp: monster.hp,
						initiativeMod: monster.init,
						initiative: 10 + monster.init,
						id: monster.id,
					});
				}
			},
			addLair: function () {
				combat.combatants.push({
					type: "lair",
					name: "Lair",
					iniativeMod: 0,
					initiative: 20,
					fixedInitiative: true,
					noHp: true,
				});
			},
			addPlayer: function (player) {
				combat.combatants.push({
					type: "player",
					name: player.name,
					initiativeMod: player.initiativeMod,
					initiative: player.initiative,
					hp: player.hp,
				});
			},
			applyDelta: function (combatant, multiplier) {
				multiplier = multiplier || 1;
				// Make sure damage is initialized
				combatant.damage = combatant.damage || 0;

				combatant.damage += combat.delta * multiplier;
				combat.delta = 0;

				// Damage can't reduce you below 0
				if ( combatant.damage > combatant.hp ) {
					combatant.damage = combatant.hp;
				}

				// Damage can't be negative
				if ( combatant.damage < 0 ) {
					combatant.damage = 0;
				}
			},
			begin: function () {
				combat.combatants.sort(function (a, b) {
					return b.initiative - a.initiative;
				});

				combat.combatants[combat.active].active = true;
			},
			init: function () {
				combat.combatants.length = 0;
				combat.active = 0;
				combat.delta = 0;

				var monsterIds = Object.keys(encounter.groups),
					lair = false,
					i, monster, qty;

				if ( ! monsterIds.length ) {
					// If there aren't any monsters, we can't run an encounter
					return false;
				}

				for ( i = 0; i < encounter.playerCount; i++ ) {
					combat.addPlayer({
						name: "Player " + (i + 1),
						initiativeMod: 0,
						initiative: 10,
						hp: 10,
					});
				}

				for ( i = 0; i < monsterIds.length; i++ ) {
					monster = monsters.byId[monsterIds[i]];
					qty = encounter.groups[monsterIds[i]].qty;
					lair = lair || monster.lair;

					combat.addMonster(monster, qty);
				}

				if ( lair ) {
					combat.addLair();
				}

				return true;
			},
			nextTurn: function () {
				combat.combatants[combat.active].active = false;
				combat.active = ( combat.active + 1 ) % combat.combatants.length;
				combat.combatants[combat.active].active = true;
			},
			rollInitiative: function (combatant) {
				combatant.initiative = util.d(20) + combatant.initiativeMod;
				combatant.initiativeRolled = true;
			},
		};

		combat.init();

		return combat;
	},
	encounter: function (store, metaInfo, monsters, party, util) {
		var encounter = {
			groups: {},
			partyLevel: metaInfo.levels[0],
			playerCount: 4,
			add: function (monster, qty) {
				if ( typeof qty === "undefined" ) {
					qty = 1;
				}

				encounter.groups[monster.id] = encounter.groups[monster.id] || {
					qty: 0,
					monster: monster,
				};

				encounter.groups[monster.id].qty += qty;
				encounter.qty += qty;
				encounter.exp += monster.cr.exp * qty;

				// TODO: Temporarily disabling all places that save encounter
				freeze();
			},
			generateRandom: function (filters) {
				var monsters = generateRandomEncounter(encounter.playerCount, encounter.partyLevel, filters),
					i;

				encounter.reset();

				for ( i = 0; i < monsters.length; i++ ) {
					encounter.add( monsters[i].monster, monsters[i].qty );
				}
			},
			randomize: function (monster, filters) {
				var monsterList = util.getShuffledMonsterList(monster.cr.string),
					qty = encounter.groups[monster.id].qty;

				while ( monsterList.length ) {
					// Make sure we don't roll a monster we already have
					if ( encounter.groups[monsterList[0].name] ) {
						monsterList.shift();
						continue;
					}

					if ( monsters.check( monsterList[0], filters, { skipCrCheck: true } ) ) {
						encounter.remove(monster, true);
						encounter.add( monsterList[0], qty );
						return;					
					} else {
						monsterList.shift();
					}
				}
			},
			recalculateThreatLevels: function () {
				var count = encounter.playerCount,
					level = encounter.partyLevel,
					mediumExp = count * level.medium,
					singleMultiplier  = 1,
					pairMultiplier    = 1.5,
					groupMultiplier   = 2,
					trivialMultiplier = 2.5;

				if ( count < 3 ) {
					// For small groups, increase multiplier
					singleMultiplier  = 1.5;
					pairMultiplier    = 2;
					groupMultiplier   = 2.5;
					trivialMultiplier = 3;
				} else if ( count > 5 ) {
					// For large groups, reduce multiplier
					singleMultiplier  = 0.5;
					pairMultiplier    = 1;
					groupMultiplier   = 1.5;
					trivialMultiplier = 2;
				}

				encounter.threat.deadly  = count * level.deadly / singleMultiplier;
				encounter.threat.hard    = count * level.hard / singleMultiplier;
				encounter.threat.medium  = mediumExp / singleMultiplier;
				encounter.threat.easy    = count * level.easy / singleMultiplier;
				encounter.threat.pair    = mediumExp / ( 2 * pairMultiplier );
				encounter.threat.group   = mediumExp / ( 4 * groupMultiplier );
				encounter.threat.trivial = mediumExp / ( 8 * trivialMultiplier );

				freeze();
			},
			remove: function (monster, removeAll) {
				encounter.groups[monster.id].qty--;
				encounter.qty--;
				encounter.exp -= monster.cr.exp;
				if ( encounter.groups[monster.id].qty === 0 ) {
					delete encounter.groups[monster.id];
				} else if ( removeAll ) {
					encounter.remove(monster, true);
				}

				// TODO
				freeze();
			},
			reset: function () {
				encounter.qty = 0;
				encounter.exp = 0;
				encounter.groups = {};
				encounter.threat = {};
			},
			threat: {},
		};

		Object.defineProperty(encounter, "adjustedExp", {
			get: function () {
				var qty = encounter.qty,
					exp = encounter.exp,
					multiplier = party.getMultiplier(encounter.playerCount, qty);

				return Math.floor(exp * multiplier);
			},
		});

		Object.defineProperty(encounter, "difficulty", {
			get: function () {
				var exp = encounter.adjustedExp,
					count = encounter.playerCount,
					level = encounter.partyLevel;

				if ( exp === 0 ) {
					return false;
				}

				if ( exp <= ( count * level.easy ) ) {
					return "Easy";
				} else if ( exp <= ( count * level.medium ) ) {
					return "Medium";
				} else if ( exp <= ( count * level.hard ) ) {
					return "Hard";
				} else if ( exp <= ( count * level.deadly ) ) {
					return "Deadly";
				} else {
					return "Ludicrous";
				}
			},
		});

		thaw();
		encounter.recalculateThreatLevels();

		function freeze() {
			var o = {
				groups: {},
				partyLevel: encounter.partyLevel.level,
				playerCount: encounter.playerCount,
			};

			Object.keys(encounter.groups).forEach(function (monsterId) {
				o.groups[monsterId] = encounter.groups[monsterId].qty;
			});

			store.set("5em-encounter", o);
		}

		function thaw() {
			encounter.reset();

			var frozen = store.get("5em-encounter");

			if ( !frozen ) {
				return;
			}

			// TODO: Need to move party-specific stuff to party service
			encounter.partyLevel = levels[frozen.partyLevel - 1]; // level 1 is index 0, etc
			encounter.playerCount = frozen.playerCount;

			Object.keys(frozen.groups).forEach(function (monsterId) {
				var monster = monsters.byId[monsterId];

				if ( !monster ) {
					console.warn("Can't find", monsterId);
					return;
				}

				encounter.add(monster, frozen.groups[monsterId]);
			});
		}

		return encounter;
	},
	metaInfo: function () {
		return {
			alignments: alignments,
			crList: crList,
			environments: environments,
			levels: levels,
			tags: tags,
			sizes: sizes,
			types: types,
		};
	},
	monsters: function () {
		return {
			all: monsters.sort(function (a, b) {
				return (a.name > b.name) ? 1 : -1;
			}),
			byId: monstersById,
			check: checkMonster,
		};
	},
	party: function () {
		return {
			getMultiplier: getMultiplier,
		};
	},
	sources: function () {
		return {
			all: sources,
			filters: sourceFilters,
		};
	},
	util: function () {
		return {
			d: d,
			getShuffledMonsterList: getShuffledMonsterList,
			partialFactory: partialFactory,
		};
	},
};