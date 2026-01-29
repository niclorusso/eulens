import React from 'react';
import './About.css';

export default function About() {
  return (
    <main className="container">
      <div className="about-page">
        <header className="about-header">
          <h1>About EULens</h1>
          <p className="subtitle">See European Democracy Clearly</p>
        </header>

        <section className="about-section card">
          <h2>What is EULens?</h2>
          <p>
            EULens is a digital platform designed to make European Parliament voting data 
            accessible, transparent, and understandable for all citizens. Our mission is to 
            bridge the gap between European citizens and their elected representatives by 
            providing clear insights into how MEPs vote on legislation that affects millions 
            of people across the European Union.
          </p>
          <p>
            EULens provides tools to analyze how your representatives vote on European policy. 
            You can explore voting patterns, compare MEPs and political groups, and understand 
            how decisions are made in the European Parliament.
          </p>
        </section>

        <section className="about-section card">
          <h2>What is the European Parliament?</h2>
          <div className="ep-explanation">
            <p>
              The <strong>European Parliament</strong> is one of the three main institutions 
              of the European Union, alongside the European Commission and the Council of the 
              European Union. It represents the voice of over 450 million European citizens.
            </p>
            
            <h3>Key Facts:</h3>
            <ul>
              <li>
                <strong>Members of European Parliament (MEPs)</strong> are directly 
                elected by EU citizens every 5 years
              </li>
              <li>
                MEPs represent citizens from all 27 EU member states, with the number of 
                MEPs per country roughly proportional to population
              </li>
              <li>
                The Parliament works together with the Council to create and pass European 
                laws that affect daily life across the EU
              </li>
              <li>
                MEPs are organized into <strong>political groups</strong> based on their 
                political views, not their nationality
              </li>
            </ul>

            <h3>What Does the Parliament Do?</h3>
            <ul>
              <li>
                <strong>Makes Laws:</strong> Works with the Council to pass legislation on 
                topics like consumer protection, environmental standards, and digital rights
              </li>
              <li>
                <strong>Oversees the Budget:</strong> Approves the EU's annual budget and 
                monitors how money is spent
              </li>
              <li>
                <strong>Supervises Other EU Institutions:</strong> Holds the European 
                Commission accountable and can vote to dismiss it
              </li>
              <li>
                <strong>Represents Citizens:</strong> Gives voice to European citizens' 
                concerns and priorities
              </li>
            </ul>

            <h3>How Voting Works:</h3>
            <p>
              The European Parliament votes in several ways, depending on the type of decision:
            </p>
            <ul>
              <li>
                <strong>Plenary Sessions:</strong> The full Parliament meets in Strasbourg or Brussels 
                to vote on legislation. These are the main votes where individual MEP positions are 
                recorded and made public.
              </li>
              <li>
                <strong>Committee Votes:</strong> Before reaching the plenary, proposals are debated 
                and voted on in specialized committees. These votes are usually not recorded individually.
              </li>
              <li>
                <strong>Voting Methods:</strong> MEPs can vote in three ways:
                <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  <li><strong>Yes (For):</strong> The MEP supports the proposal</li>
                  <li><strong>No (Against):</strong> The MEP opposes the proposal</li>
                  <li><strong>Abstain:</strong> The MEP neither supports nor opposes, often used 
                  when the proposal is too complex or the MEP wants to remain neutral</li>
                </ul>
              </li>
            </ul>
            <p>
              <strong>Why Our Dataset Only Includes Some Votes:</strong> EULens tracks votes from 
              <strong>plenary sessions</strong> where individual MEP positions are recorded and published. 
              This means we have data on the most important legislative votes—final decisions on laws, 
              resolutions, and major policy positions. However, we don't include:
            </p>
            <ul>
              <li>Committee votes (where most detailed work happens but individual positions aren't recorded)</li>
              <li>Votes taken by show of hands or other non-recorded methods</li>
              <li>Internal group meetings or preliminary discussions</li>
            </ul>
            <p>
              Despite these limitations, plenary votes represent the final, binding decisions of the 
              Parliament and provide a clear picture of how MEPs and political groups position themselves 
              on major European issues. By tracking these votes, we can see patterns, understand political 
              alliances, and hold representatives accountable for their final decisions.
            </p>
          </div>
        </section>

        <section className="about-section card">
          <h2>Features of This Platform</h2>
          <div className="features-grid">
            <div className="feature-item">
              <h3>📊 Voting Records</h3>
              <p>
                Explore how MEPs vote on legislation. See individual voting histories, 
                patterns, and trends over time.
              </p>
            </div>
            <div className="feature-item">
              <h3>👥 MEP Profiles</h3>
              <p>
                Learn about individual Members of European Parliament, their voting records, 
                political groups, and find MEPs with similar voting patterns.
              </p>
            </div>
            <div className="feature-item">
              <h3>🏛️ Political Groups</h3>
              <p>
                Understand how political groups vote as a whole. See cohesion within groups 
                and agreements between different groups.
              </p>
            </div>
            <div className="feature-item">
              <h3>🌍 Country Analysis</h3>
              <p>
                See how different EU member states' MEPs vote, revealing national perspectives 
                on European issues.
              </p>
            </div>
            <div className="feature-item">
              <h3>🧭 Compass</h3>
              <p>
                Visualize MEP voting patterns in 2D and 3D. See how MEPs and political groups 
                cluster based on their voting behavior.
              </p>
            </div>
            <div className="feature-item">
              <h3>🎯 Find Your Match</h3>
              <p>
                Use our Voting Advice Application (VAA) to find which MEPs align most closely 
                with your views on key issues.
              </p>
            </div>
            <div className="feature-item">
              <h3>💬 Chat with a MEP</h3>
              <p>
                Have a conversation with AI representatives of each political group. Ask about 
                their positions, why they vote certain ways, and their vision for Europe.
              </p>
            </div>
          </div>
        </section>

        <section className="about-section card">
          <h2>Our Mission</h2>
          <p>
            Democracy works best when citizens are informed and engaged. EULens aims to:
          </p>
          <ul>
            <li>
              <strong>Increase Transparency:</strong> Make European Parliament voting data 
              easily accessible to everyone
            </li>
            <li>
              <strong>Promote Understanding:</strong> Present complex political data in clear, 
              visual formats that anyone can understand
            </li>
            <li>
              <strong>Encourage Engagement:</strong> Help citizens connect with their 
              representatives and understand how their votes in European elections translate 
              into policy
            </li>
            <li>
              <strong>Foster Accountability:</strong> Enable citizens to track how their 
              elected representatives vote on issues that matter to them
            </li>
          </ul>
        </section>

        <section className="about-section card">
          <h2>Data Sources</h2>
          <p>
            EULens is powered by the <a href="https://howtheyvote.eu" target="_blank" rel="noopener noreferrer"><strong>HowTheyVote.eu API</strong></a>, 
            an open-source project that collects and provides structured data on European Parliament 
            plenary votes. HowTheyVote.eu scrapes and processes official voting records from the 
            European Parliament, making them accessible through a clean, developer-friendly API.
          </p>
          <p>
            We are grateful to the HowTheyVote.eu team for their excellent work in making 
            European Parliament data accessible. Their commitment to transparency and open data 
            makes projects like EULens possible.
          </p>
          <p>
            All voting records are official and public, as required by EU transparency 
            regulations. The data is updated regularly to reflect the latest votes and legislative 
            activities in the European Parliament.
          </p>
        </section>

        <section className="about-section card">
          <h2>Get Involved</h2>
          <p>
            European democracy belongs to all of us. Use this platform to:
          </p>
          <ul>
            <li>Research how your MEPs vote before elections</li>
            <li>Understand the positions of different political groups</li>
            <li>Track how legislation you care about is being decided</li>
            <li>Engage with your representatives based on data, not just promises</li>
          </ul>
          <p>
            <strong>Remember:</strong> Your vote in European Parliament elections matters. 
            The MEPs you elect will make decisions that affect your daily life, from 
            environmental protection to digital rights, from consumer safety to economic 
            policies.
          </p>
        </section>

        <footer className="about-footer">
          <p>
            <strong>EULens</strong> - See European Democracy Clearly
          </p>
          <p className="footer-note">
            This platform is an independent project created to promote transparency and 
            citizen engagement with European democracy.
          </p>
        </footer>
      </div>
    </main>
  );
}
