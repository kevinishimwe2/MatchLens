fetch('/api/matches')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                displayMatches(data.matches);
            })
            .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
            });
