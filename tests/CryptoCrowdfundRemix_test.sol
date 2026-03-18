// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "../contracts/CryptoCrowdfund.sol";

contract Actor {
    receive() external payable {}

    function donate(CryptoCrowdfund target, uint256 campaignId, uint256 amount) external {
        target.donate{value: amount}(campaignId);
    }

    function cancelCampaign(CryptoCrowdfund target, uint256 campaignId) external {
        target.cancelCampaign(campaignId);
    }

    function refund(CryptoCrowdfund target, uint256 campaignId) external {
        target.refund(campaignId);
    }

    function myDonation(CryptoCrowdfund target, uint256 campaignId) external view returns (uint256) {
        return target.getMyDonation(campaignId);
    }
}

contract CryptoCrowdfundRemixTest {
    CryptoCrowdfund private crowdfund;
    Actor private creator;
    Actor private donor;

    function beforeAll() public {
        crowdfund = new CryptoCrowdfund(250);
        creator = new Actor();
        donor = new Actor();

        payable(address(creator)).transfer(2 ether);
        payable(address(donor)).transfer(2 ether);
    }

    receive() external payable {}

    function checkOwnerAndFeeConfig() public {
        Assert.equal(crowdfund.platformFeeBps(), uint256(250), "Initial fee should be 250 bps");
        Assert.equal(crowdfund.feeRecipient(), address(this), "Fee recipient should default to deployer");
    }

    function shouldCreateCampaign() public {
        uint256 campaignId = crowdfund.createCampaign(
            "Clean Water",
            "Build a clean water line for the village",
            1 ether,
            7 days
        );

        (
            address campaignCreator,
            string memory title,
            ,
            uint256 goal,
            ,
            uint256 pledged,
            bool goalMet,
            bool released,
            bool cancelled
        ) = crowdfund.getCampaign(campaignId);

        Assert.equal(campaignCreator, address(this), "Creator should be test contract");
        Assert.equal(title, string("Clean Water"), "Title should match");
        Assert.equal(goal, uint256(1 ether), "Goal should match");
        Assert.equal(pledged, uint256(0), "No pledges initially");
        Assert.equal(goalMet, false, "Goal should not be met initially");
        Assert.equal(released, false, "Campaign should not be released initially");
        Assert.equal(cancelled, false, "Campaign should not be cancelled initially");
    }

    function shouldAcceptDonationAndTrackAmount() public {
        uint256 campaignId = crowdfund.createCampaign(
            "School Supplies",
            "Fund backpacks and books",
            1 ether,
            7 days
        );

        donor.donate(crowdfund, campaignId, 0.4 ether);

        (, , , , , uint256 pledged, , , ) = crowdfund.getCampaign(campaignId);
        uint256 donorRecordedAmount = donor.myDonation(crowdfund, campaignId);

        Assert.equal(pledged, uint256(0.4 ether), "Pledged total should update");
        Assert.equal(donorRecordedAmount, uint256(0.4 ether), "Donor amount should update");
    }

    function shouldAllowCancelAndRefund() public {
        uint256 campaignId = crowdfund.createCampaign(
            "Community Garden",
            "Grow local food",
            3 ether,
            10 days
        );

        uint256 donorBalanceBefore = address(donor).balance;

        donor.donate(crowdfund, campaignId, 0.7 ether);
        crowdfund.cancelCampaign(campaignId);
        donor.refund(crowdfund, campaignId);

        (, , , , , uint256 pledged, , , bool cancelled) = crowdfund.getCampaign(campaignId);
        uint256 donorBalanceAfter = address(donor).balance;
        uint256 donorRecordedAmount = donor.myDonation(crowdfund, campaignId);

        Assert.equal(cancelled, true, "Campaign should be cancelled");
        Assert.equal(pledged, uint256(0.7 ether), "Total pledged remains as historical total");
        Assert.equal(donorRecordedAmount, uint256(0), "Donor balance in contract should be zero after refund");
        Assert.equal(donorBalanceAfter, donorBalanceBefore, "Donor should receive the full refund");
    }

    function shouldRejectRefundWithoutDonation() public {
        uint256 campaignId = crowdfund.createCampaign(
            "Open Library",
            "Build a neighborhood library",
            2 ether,
            10 days
        );

        crowdfund.cancelCampaign(campaignId);

        try crowdfund.refund(campaignId) {
            Assert.ok(false, "Refund should fail when nothing was donated");
        } catch {
            Assert.ok(true, "Refund revert expected");
        }
    }
}
