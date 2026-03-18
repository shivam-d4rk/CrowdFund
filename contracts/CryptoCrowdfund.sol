// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CryptoCrowdfund {
    struct Campaign {
        address payable creator;
        string title;
        string description;
        uint256 goal;
        uint256 deadline;
        uint256 totalPledged;
        bool released;
        bool cancelled;
    }

    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000;
    address public owner;
    address payable public feeRecipient;
    uint256 public platformFeeBps;

    uint256 public campaignCount;

    mapping(uint256 => Campaign) private campaigns;
    mapping(uint256 => mapping(address => uint256)) private pledgedAmount;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        string title,
        uint256 goal,
        uint256 deadline
    );
    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );
    event FundsReleased(
        uint256 indexed campaignId,
        address indexed creator,
        uint256 creatorAmount,
        uint256 platformFee
    );
    event Refunded(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );
    event CampaignCancelled(uint256 indexed campaignId, address indexed creator);
    event PlatformFeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address indexed newFeeRecipient);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier campaignExists(uint256 campaignId) {
        require(campaignId > 0 && campaignId <= campaignCount, "Campaign does not exist");
        _;
    }

    constructor(uint256 initialPlatformFeeBps) {
        require(initialPlatformFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");

        owner = msg.sender;
        feeRecipient = payable(msg.sender);
        platformFeeBps = initialPlatformFeeBps;
    }

    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address payable newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid recipient");
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(newFeeRecipient);
    }

    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 goal,
        uint256 durationInSeconds
    ) external returns (uint256 campaignId) {
        require(bytes(title).length > 0, "Title required");
        require(goal > 0, "Goal must be > 0");
        require(durationInSeconds > 0, "Duration must be > 0");

        campaignId = ++campaignCount;

        campaigns[campaignId] = Campaign({
            creator: payable(msg.sender),
            title: title,
            description: description,
            goal: goal,
            deadline: block.timestamp + durationInSeconds,
            totalPledged: 0,
            released: false,
            cancelled: false
        });

        emit CampaignCreated(
            campaignId,
            msg.sender,
            title,
            goal,
            campaigns[campaignId].deadline
        );
    }

    function donate(uint256 campaignId) external payable campaignExists(campaignId) {
        Campaign storage c = campaigns[campaignId];

        require(msg.value > 0, "Donation must be > 0");
        require(block.timestamp < c.deadline, "Campaign ended");
        require(!c.released, "Funds already released");
        require(!c.cancelled, "Campaign cancelled");

        pledgedAmount[campaignId][msg.sender] += msg.value;
        c.totalPledged += msg.value;

        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function cancelCampaign(uint256 campaignId) external campaignExists(campaignId) {
        Campaign storage c = campaigns[campaignId];

        require(msg.sender == c.creator, "Only creator can cancel");
        require(block.timestamp < c.deadline, "Campaign already ended");
        require(!c.released, "Already released");
        require(!c.cancelled, "Already cancelled");
        require(c.totalPledged < c.goal, "Cannot cancel goal-met campaign");

        c.cancelled = true;

        emit CampaignCancelled(campaignId, msg.sender);
    }

    function releaseFunds(uint256 campaignId) external campaignExists(campaignId) {
        Campaign storage c = campaigns[campaignId];

        require(msg.sender == c.creator, "Only creator can release funds");
        require(block.timestamp >= c.deadline, "Campaign still active");
        require(c.totalPledged >= c.goal, "Funding goal not met");
        require(!c.released, "Already released");
        require(!c.cancelled, "Campaign cancelled");

        c.released = true;
        uint256 amount = c.totalPledged;
        uint256 feeAmount = (amount * platformFeeBps) / 10_000;
        uint256 creatorAmount = amount - feeAmount;

        if (feeAmount > 0) {
            (bool feeSent, ) = feeRecipient.call{value: feeAmount}("");
            require(feeSent, "Fee transfer failed");
        }

        (bool sent, ) = c.creator.call{value: creatorAmount}("");
        require(sent, "Creator transfer failed");

        emit FundsReleased(campaignId, c.creator, creatorAmount, feeAmount);
    }

    function refund(uint256 campaignId) external campaignExists(campaignId) {
        Campaign storage c = campaigns[campaignId];

        bool refundableByFailure = block.timestamp >= c.deadline && c.totalPledged < c.goal;
        require(c.cancelled || refundableByFailure, "Refund not available");

        uint256 donated = pledgedAmount[campaignId][msg.sender];
        require(donated > 0, "Nothing to refund");

        // Effects before interaction protects against reentrancy.
        pledgedAmount[campaignId][msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: donated}("");
        require(sent, "Refund failed");

        emit Refunded(campaignId, msg.sender, donated);
    }

    function getCampaign(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (
            address creator,
            string memory title,
            string memory description,
            uint256 goal,
            uint256 deadline,
            uint256 totalPledged,
            bool goalMet,
            bool released,
            bool cancelled
        )
    {
        Campaign storage c = campaigns[campaignId];

        return (
            c.creator,
            c.title,
            c.description,
            c.goal,
            c.deadline,
            c.totalPledged,
            c.totalPledged >= c.goal,
            c.released,
            c.cancelled
        );
    }

    function getMyDonation(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        return pledgedAmount[campaignId][msg.sender];
    }

    function campaignGoalReached(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (bool)
    {
        Campaign storage c = campaigns[campaignId];
        return c.totalPledged >= c.goal;
    }

    function timeLeft(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        Campaign storage c = campaigns[campaignId];

        if (block.timestamp >= c.deadline) {
            return 0;
        }

        return c.deadline - block.timestamp;
    }
}
