export const childhoodEvents = [
  {
    id: 'parent_hobby_exposure',
    title: 'Aile Etkisi',
    condition: (state) => state.player.age >= 5 && Object.keys(state.player.interests).length > 0,
    weight: () => 2,
    choices: [
      {
        id: 'join',
        label: 'İlgilen',
        result: 'Ailenin ilgilendiği bir hobiye daha çok zaman ayırdın.',
        effect: (state) => {
          const first = Object.keys(state.player.interests)[0];
          state.player.interests[first] = Math.min(100, state.player.interests[first] + 8);
        }
      },
      {
        id: 'ignore',
        label: 'Başka şeylerle ilgilen',
        result: 'Kendi alanını keşfetmeyi tercih ettin.',
        effect: (state) => { state.player.personality.curiosity = Math.min(100, state.player.personality.curiosity + 4); }
      }
    ]
  }
];
